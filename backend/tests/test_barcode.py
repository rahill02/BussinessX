import pytest
from pydantic import ValidationError

import services
from barcode_service import CatalogUnavailable, build_name, normalize_barcode
from schemas import ItemCreate, ItemEdit


def new_item(db, name, barcode=None, price=160):
    return services.create_item(db, ItemCreate(name=name, type="normal", qty=10, cost_price=100,
                                               selling_price=price, barcode=barcode))


def no_internet(code):
    raise CatalogUnavailable()


def test_barcode_is_optional_and_many_items_can_have_none(db):
    a = new_item(db, "Loose ribbon")
    b = new_item(db, "Loose thread")
    assert a.barcode is None and b.barcode is None


def test_spaces_are_removed_and_odd_characters_rejected():
    assert normalize_barcode(" 8901 0588 52332 ") == "8901058852332"
    assert normalize_barcode("   ") is None
    assert normalize_barcode(None) is None
    with pytest.raises(ValueError):
        normalize_barcode("12#34")
    with pytest.raises(ValidationError):
        ItemCreate(name="x", type="normal", barcode="ab")  # too short


def test_scanning_your_own_barcode_gives_the_name_and_selling_price(db):
    item = new_item(db, "Fortune Oil 1L", barcode="8901234567890", price=160)
    found = services.lookup_barcode(db, "8901234567890", catalog=no_internet)
    assert found["source"] == "shop"
    assert found["item"]["id"] == item.id
    assert found["item"]["name"] == "Fortune Oil 1L"
    assert found["item"]["next_sell_price"] == 160  # the price a sale would use


def test_one_barcode_cannot_belong_to_two_items(db):
    new_item(db, "Fortune Oil 1L", barcode="8901234567890")
    with pytest.raises(ValueError, match="already used by \"Fortune Oil 1L\""):
        new_item(db, "Another oil", barcode="8901234567890")

    other = new_item(db, "Another oil")
    with pytest.raises(ValueError, match="already used by"):
        services.edit_item(db, other.id, ItemEdit(barcode="8901234567890"))


def test_barcode_can_be_added_changed_and_removed_on_an_existing_item(db):
    item = new_item(db, "Salt")
    services.edit_item(db, item.id, ItemEdit(barcode="111222333"))
    assert services.item_stock_summary(db, item.id)["barcode"] == "111222333"

    services.edit_item(db, item.id, ItemEdit(name="Tata Salt"))  # an edit that does not mention it keeps it
    assert services.item_stock_summary(db, item.id)["barcode"] == "111222333"

    services.edit_item(db, item.id, ItemEdit(barcode="111222333"))  # saving its own barcode again is fine
    services.edit_item(db, item.id, ItemEdit(barcode=None))  # null removes it
    assert services.item_stock_summary(db, item.id)["barcode"] is None


def test_unknown_barcode_takes_the_name_from_the_public_list(db):
    found = services.lookup_barcode(db, "3017620422003", catalog=lambda code: {"name": "Nutella 750 g"})
    assert found == {"source": "catalog", "barcode": "3017620422003", "name": "Nutella 750 g"}


def test_unknown_barcode_with_no_match_or_no_internet_never_blocks(db):
    not_listed = services.lookup_barcode(db, "999888777", catalog=lambda code: None)
    assert not_listed == {"source": "none", "barcode": "999888777"}

    offline = services.lookup_barcode(db, "999888777", catalog=no_internet)
    assert offline["source"] == "none" and offline["catalog_error"] is True


def test_sell_screen_lookup_skips_the_public_list(db):
    def must_not_be_called(code):
        raise AssertionError("the Sell screen only wants your own items")

    found = services.lookup_barcode(db, "999888777", use_catalog=False, catalog=must_not_be_called)
    assert found["source"] == "none"


def test_catalog_name_is_built_without_repeating_words():
    assert build_name({"product_name": "Masala Noodles", "brands": "Maggi, Nestle", "quantity": "70 g"}) == \
        "Maggi Masala Noodles 70 g"
    assert build_name({"product_name": "Maggi Masala Noodles 70 g", "brands": "Maggi", "quantity": "70 g"}) == \
        "Maggi Masala Noodles 70 g"
    assert build_name({"product_name": "Tea", "brands": "", "quantity": ""}) == "Tea"
    assert build_name({"product_name": "  ", "brands": "Maggi"}) is None
