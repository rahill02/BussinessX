"""Barcode helpers. Standard library only, so schemas and services can both import it.

Barcodes are optional: most items work fine without one.
"""
import json
import re
import urllib.error
import urllib.request
from urllib.parse import quote

# the free Open Food Facts product list. Only the barcode number is sent; it has names but no prices.
CATALOG_URL = "https://world.openfoodfacts.org/api/v2/product/{code}.json?fields=product_name,brands,quantity"
CATALOG_TIMEOUT = 8  # seconds: the first call can take ~4s, but a slow list must never block adding an item

_ALLOWED = re.compile(r"^[A-Za-z0-9._/\-]{3,40}$")


class CatalogUnavailable(Exception):
    """No internet, or the product list did not answer."""


def normalize_barcode(value):
    """Trim and remove spaces (scanners and typing add them). Empty means no barcode."""
    if value is None:
        return None
    code = re.sub(r"\s+", "", str(value))
    if not code:
        return None
    if not _ALLOWED.match(code):
        raise ValueError("A barcode can only have letters, numbers and - . _ / (3 to 40 characters).")
    return code


def build_name(product):
    """'Maggi' + 'Masala Noodles' + '70 g' -> 'Maggi Masala Noodles 70 g', without repeating words."""
    name = (product.get("product_name") or "").strip()
    if not name:
        return None
    brand = (product.get("brands") or "").split(",")[0].strip()
    size = (product.get("quantity") or "").strip()
    if brand and brand.lower() not in name.lower():
        name = f"{brand} {name}"
    if size and size.lower() not in name.lower():
        name = f"{name} {size}"
    return name


def lookup_catalog(code):
    """Name for a barcode from the public list: {'name': ...}, or None if it is not listed.

    Raises CatalogUnavailable when there is no internet, so the screen can say so and let the user type the name.
    """
    request = urllib.request.Request(
        CATALOG_URL.format(code=quote(code, safe="")), headers={"User-Agent": "BusinessX-demo/1.0"}
    )
    try:
        with urllib.request.urlopen(request, timeout=CATALOG_TIMEOUT) as response:
            body = json.load(response)
    except urllib.error.HTTPError as e:
        if e.code == 404:  # the list answers 404 for codes it has never seen
            return None
        raise CatalogUnavailable() from e
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as e:
        raise CatalogUnavailable() from e
    if body.get("status") != 1:
        return None
    name = build_name(body.get("product") or {})
    return {"name": name} if name else None
