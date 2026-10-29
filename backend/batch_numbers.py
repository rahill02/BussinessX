"""Batch (lot) numbers. Standard library only.

Every purchase batch has a unique number. If the user does not type one, the next number in a
running series is used: B-0001, B-0002, B-0003 ...
"""
import re

PREFIX = "B-"
PAD = 4  # B-0007; after B-9999 it simply grows to B-10000

_ALLOWED = re.compile(r"^[A-Za-z0-9._/\-]{1,40}$")
_AUTO = re.compile(r"^B-(\d+)$")


def normalize_batch_no(value):
    """Trim and remove spaces. Empty means 'number it for me'."""
    if value is None:
        return None
    text = re.sub(r"\s+", "", str(value))
    if not text:
        return None
    if not _ALLOWED.match(text):
        raise ValueError("A batch number can only have letters, numbers and - . _ / (up to 40 characters).")
    return text


def format_batch_no(n):
    return f"{PREFIX}{n:0{PAD}d}"


def auto_number_value(batch_no):
    """B-0007 -> 7. Anything the user typed in another style -> None (it does not affect the series)."""
    match = _AUTO.match(batch_no or "")
    return int(match.group(1)) if match else None
