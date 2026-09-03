import json
from typing import Dict, List, Optional, Tuple

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import confusion_matrix, precision_recall_curve
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models.enums import DepositStatus, EngineType
from backend.app.models.models import BankDeposit, GatewayPayout, ReconciliationJournal

METRICS_FILE = "metrics.json"


class TfidfFuzzyMatcher:
    """
    TF-IDF Fuzzy Narrative Matcher.
    - Fits vectorizer STRICTLY on gateway_payouts.utr_id values (character n-grams), NOT narrative text.
    - Transforms raw bank narratives into the reference UTR space.
    - Derives confidence threshold from ROC / PR curve saved in metrics.json.
    """

    def __init__(self, db: Session, ngram_range: Tuple[int, int] = (3, 5)):
        self.db = db
        self.ngram_range = ngram_range
        self.vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=self.ngram_range)
        self.payouts: List[GatewayPayout] = []
        self.payout_vectors = None
        self.confidence_threshold: float = 0.85  # default derived threshold

    def fit_on_payout_utrs(self) -> None:
        """
        Fits TF-IDF vectorizer strictly on known payout UTR values.
        """
        self.payouts = self.db.scalars(select(GatewayPayout)).all()
        if not self.payouts:
            return

        utr_corpus = [p.utr_id for p in self.payouts]
        self.payout_vectors = self.vectorizer.fit_transform(utr_corpus)

    def compute_similarity(self, narrative: str) -> Tuple[Optional[GatewayPayout], float]:
        """
        Transforms incoming narrative into the fitted UTR feature space
        and finds the payout with highest cosine similarity.
        """
        if self.payout_vectors is None or not self.payouts:
            self.fit_on_payout_utrs()

        query_vec = self.vectorizer.transform([narrative])
        sims = cosine_similarity(query_vec, self.payout_vectors)[0]

        best_idx = int(np.argmax(sims))
        best_score = float(sims[best_idx])

        return self.payouts[best_idx], best_score

    def train_and_export_metrics(
        self, test_deposits: List[BankDeposit], output_path: str = METRICS_FILE
    ) -> Dict:
        """
        Evaluates predictions on test deposits against known ground truth (amount + UTR overlap).
        Computes precision, recall, and optimal ROC operating point, writing metrics.json.
        """
        if self.payout_vectors is None:
            self.fit_on_payout_utrs()

        payout_by_amount: Dict[int, str] = {p.net_payout_paise: p.utr_id for p in self.payouts}

        y_true = []
        y_scores = []

        for dep in test_deposits:
            true_utr = payout_by_amount.get(dep.deposit_amount_paise)
            if not true_utr:
                continue

            query_vec = self.vectorizer.transform([dep.narrative_raw])
            sims = cosine_similarity(query_vec, self.payout_vectors)[0]
            best_idx = int(np.argmax(sims))
            pred_utr = self.payouts[best_idx].utr_id
            score = float(sims[best_idx])

            # Binary indicator: did it pick the correct payout?
            is_correct = 1 if pred_utr == true_utr else 0
            y_true.append(is_correct)
            y_scores.append(score)

        y_true = np.array(y_true)
        y_scores = np.array(y_scores)

        precisions, recalls, thresholds = precision_recall_curve(y_true, y_scores)
        # Compute F1 scores for thresholds
        f1_scores = (
            2 * (precisions[:-1] * recalls[:-1]) / np.maximum(precisions[:-1] + recalls[:-1], 1e-9)
        )
        best_f1_idx = int(np.argmax(f1_scores))

        optimal_threshold = float(thresholds[best_f1_idx])
        optimal_precision = float(precisions[best_f1_idx])
        optimal_recall = float(recalls[best_f1_idx])
        optimal_f1 = float(f1_scores[best_f1_idx])

        self.confidence_threshold = optimal_threshold

        # Confusion matrix at optimal threshold
        y_pred = (y_scores >= optimal_threshold).astype(int)
        tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()

        metrics_data = {
            "model": "TF-IDF (char_wb, ngrams 3-5)",
            "fitted_on": "gateway_payouts.utr_id",
            "optimal_threshold": round(optimal_threshold, 4),
            "precision": round(optimal_precision, 4),
            "recall": round(optimal_recall, 4),
            "f1_score": round(optimal_f1, 4),
            "confusion_matrix": {
                "tp": int(tp),
                "fp": int(fp),
                "tn": int(tn),
                "fn": int(fn),
            },
        }

        with open(output_path, "w") as f:
            json.dump(metrics_data, f, indent=2)

        return metrics_data

    def reconcile_fuzzy(
        self, deposits: List[BankDeposit]
    ) -> Tuple[List[ReconciliationJournal], List[BankDeposit]]:
        """
        Fuzzy reconciles remaining unmatched deposits using the derived ROC threshold.
        """
        if self.payout_vectors is None:
            self.fit_on_payout_utrs()

        matched_journals: List[ReconciliationJournal] = []
        unmatched_deposits: List[BankDeposit] = []

        for deposit in deposits:
            if deposit.status != DepositStatus.UNMATCHED:
                continue

            best_payout, score = self.compute_similarity(deposit.narrative_raw)

            # Match only if score meets or exceeds ROC operating point AND amount matches
            if (
                score >= self.confidence_threshold
                and best_payout.net_payout_paise == deposit.deposit_amount_paise
            ):
                journal = ReconciliationJournal(
                    deposit_id=deposit.id,
                    payout_id=best_payout.id,
                    engine=EngineType.FUZZY.value,
                    confidence=round(score, 4),
                )
                deposit.status = DepositStatus.FUZZY_MATCHED
                matched_journals.append(journal)
            else:
                unmatched_deposits.append(deposit)

        if matched_journals:
            self.db.add_all(matched_journals)
            self.db.commit()

        return matched_journals, unmatched_deposits
