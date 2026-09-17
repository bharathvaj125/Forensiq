"""
Training script for the Repeat Offender TF-IDF linkage model.
"""

from sklearn.feature_extraction.text import TfidfVectorizer

def train_repeat_offender_model() -> TfidfVectorizer:
    """Train and return TfidfVectorizer over sample suspect names and alias tokens."""
    names = [
        "Sharath Kumar", "Sharath alias D-Gang", "Ramesh Patil", "Ramesh Chandra",
        "Santosh Gungloo", "Anil Kumar", "Basavaraj", "Venkatesh Gowda"
    ]
    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4))
    vec.fit(names)
    return vec
