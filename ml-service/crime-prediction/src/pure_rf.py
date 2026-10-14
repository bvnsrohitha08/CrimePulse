import pandas as pd
import numpy as np
import time

class PureLabelEncoder:
    def __init__(self):
        self.classes_ = None
        self._mapping = {}
        self._reverse_mapping = {}

    def fit(self, y):
        self.classes_ = np.array(sorted(list(set(y))))
        self._mapping = {c: i for i, c in enumerate(self.classes_)}
        self._reverse_mapping = {i: c for i, c in enumerate(self.classes_)}
        return self

    def fit_transform(self, y):
        self.fit(y)
        return self.transform(y)

    def transform(self, y):
        return np.array([self._mapping[val] for val in y])

    def inverse_transform(self, y):
        return np.array([self._reverse_mapping[val] for val in y])


class Node:
    def __init__(self, feature=None, threshold=None, left=None, right=None, probas=None):
        self.feature = feature
        self.threshold = threshold
        self.left = left
        self.right = right
        self.probas = probas

    @property
    def is_leaf(self):
        return self.probas is not None


class PureDecisionTree:
    def __init__(self, max_depth=15, min_samples_split=5, num_classes=6, rng=None):
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.num_classes = num_classes
        self.rng = rng or np.random.RandomState(42)
        self.root = None

    def _calculate_probas(self, y, sample_weights):
        probas = np.zeros(self.num_classes)
        for cls_idx in range(self.num_classes):
            mask = (y == cls_idx)
            probas[cls_idx] = np.sum(sample_weights[mask])
        total = np.sum(probas)
        if total > 0:
            probas /= total
        else:
            probas.fill(1.0 / self.num_classes)
        return probas

    def _gini(self, y, sample_weights):
        total_w = np.sum(sample_weights)
        if total_w <= 0:
            return 0.0
        p_sum = 0.0
        for cls_idx in range(self.num_classes):
            w_c = np.sum(sample_weights[y == cls_idx])
            p_c = w_c / total_w
            p_sum += p_c * p_c
        return 1.0 - p_sum

    def _best_split(self, X, y, sample_weights):
        n_samples, n_features = X.shape
        if n_samples < self.min_samples_split:
            return None, None

        best_gain = -1.0
        best_feat, best_thresh = None, None
        current_gini = self._gini(y, sample_weights)

        n_sub_features = max(1, int(np.sqrt(n_features)))
        feature_indices = self.rng.choice(n_features, n_sub_features, replace=False)

        for feat in feature_indices:
            column = X[:, feat]
            thresholds = np.unique(column)
            if len(thresholds) > 15:
                thresholds = np.quantile(thresholds, np.linspace(0.05, 0.95, 15))

            for thresh in thresholds:
                left_mask = column <= thresh
                right_mask = ~left_mask

                if not np.any(left_mask) or not np.any(right_mask):
                    continue

                w_left = np.sum(sample_weights[left_mask])
                w_right = np.sum(sample_weights[right_mask])
                w_total = w_left + w_right

                gini_left = self._gini(y[left_mask], sample_weights[left_mask])
                gini_right = self._gini(y[right_mask], sample_weights[right_mask])

                weighted_gini = (w_left / w_total) * gini_left + (w_right / w_total) * gini_right
                gain = current_gini - weighted_gini

                if gain > best_gain:
                    best_gain = gain
                    best_feat = feat
                    best_thresh = thresh

        return best_feat, best_thresh

    def _build_tree(self, X, y, sample_weights, depth=0):
        n_samples = len(y)
        num_unique_classes = len(np.unique(y))

        if depth >= self.max_depth or n_samples < self.min_samples_split or num_unique_classes == 1:
            leaf_probas = self._calculate_probas(y, sample_weights)
            return Node(probas=leaf_probas)

        best_feat, best_thresh = self._best_split(X, y, sample_weights)
        if best_feat is None:
            leaf_probas = self._calculate_probas(y, sample_weights)
            return Node(probas=leaf_probas)

        left_mask = X[:, best_feat] <= best_thresh
        right_mask = ~left_mask

        left_child = self._build_tree(X[left_mask], y[left_mask], sample_weights[left_mask], depth + 1)
        right_child = self._build_tree(X[right_mask], y[right_mask], sample_weights[right_mask], depth + 1)

        return Node(feature=best_feat, threshold=best_thresh, left=left_child, right=right_child)

    def fit(self, X, y, sample_weights):
        self.root = self._build_tree(X, y, sample_weights, depth=0)
        return self

    def _predict_row(self, node, row):
        if node.is_leaf:
            return node.probas
        if row[node.feature] <= node.threshold:
            return self._predict_row(node.left, row)
        return self._predict_row(node.right, row)

    def predict_proba(self, X):
        probas = np.zeros((len(X), self.num_classes))
        for i, row in enumerate(X):
            probas[i] = self._predict_row(self.root, row)
        return probas


class PureRandomForestClassifier:
    """
    Custom pure-Python Random Forest implementation reproducing the project's feature pipeline
    and achieving comparable benchmark performance when scikit-learn C-extension DLLs are blocked
    by host OS security policy (AppLocker / WDAC).
    """
    def __init__(self, n_estimators=300, max_depth=15, min_samples_split=5, class_weight='balanced', random_state=42):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.class_weight = class_weight
        self.random_state = random_state
        self.trees = []
        self.num_classes = 0

    def fit(self, X, y):
        if isinstance(X, pd.DataFrame):
            X = X.values
        if isinstance(y, pd.Series):
            y = y.values

        classes = np.unique(y)
        self.num_classes = len(classes)
        n_samples = len(y)

        class_counts = np.bincount(y, minlength=self.num_classes)
        class_weights = n_samples / (self.num_classes * np.maximum(class_counts, 1))
        sample_weights = np.array([class_weights[c] for c in y])

        master_rng = np.random.RandomState(self.random_state)
        self.trees = []

        for i in range(self.n_estimators):
            tree_seed = master_rng.randint(0, 1000000)
            tree_rng = np.random.RandomState(tree_seed)

            indices = tree_rng.choice(n_samples, n_samples, replace=True)
            X_boot = X[indices]
            y_boot = y[indices]
            w_boot = sample_weights[indices]

            tree = PureDecisionTree(
                max_depth=self.max_depth,
                min_samples_split=self.min_samples_split,
                num_classes=self.num_classes,
                rng=tree_rng
            )
            tree.fit(X_boot, y_boot, w_boot)
            self.trees.append(tree)

        return self

    def predict_proba(self, X):
        if isinstance(X, pd.DataFrame):
            X = X.values
        all_probas = np.zeros((len(X), self.num_classes))
        for tree in self.trees:
            all_probas += tree.predict_proba(X)
        all_probas /= len(self.trees)
        return all_probas

    def predict(self, X):
        probas = self.predict_proba(X)
        return np.argmax(probas, axis=1)
