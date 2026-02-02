"""Tests for file loaders."""
import pytest

from semantic_search_core.ingest import detect_format, load_records, preview_records


def test_detect_csv(tmp_path):
    p = tmp_path / "a.csv"
    p.write_text("id,name,text\n1,foo,hello world\n2,bar,hi")
    assert detect_format(str(p)) == "csv"


def test_detect_json(tmp_path):
    p = tmp_path / "a.json"
    p.write_text('[{"id": 1, "t": "x"}]')
    assert detect_format(str(p)) == "json"


def test_detect_jsonl(tmp_path):
    p = tmp_path / "a.jsonl"
    p.write_text('{"id": 1}\n{"id": 2}')
    assert detect_format(str(p)) == "jsonl"


def test_csv_load(tmp_path):
    p = tmp_path / "a.csv"
    p.write_text("id,title,text\n1,First,Hello world\n2,Second,Hi there")
    records = load_records(str(p), "csv", {})
    assert len(records) == 2
    assert records[0]["id"] == "1"
    assert records[0]["title"] == "First"
    assert records[0]["text"] == "Hello world"


def test_csv_preview(tmp_path):
    p = tmp_path / "a.csv"
    p.write_text("id,title,text\n1,First,Hello\n2,Second,Hi\n3,Third,Hey\n4,Fourth,Hola\n5,Fifth,Bye")
    preview = preview_records(str(p), "csv", {}, max_rows=3)
    assert len(preview) == 3


def test_detect_tsv(tmp_path):
    p = tmp_path / "a.tsv"
    p.write_text("id\tname\ttext\n1\tfoo\thello world\n2\tbar\thi")
    assert detect_format(str(p)) == "tsv"


def test_tsv_load(tmp_path):
    p = tmp_path / "a.tsv"
    p.write_text("id\ttitle\ttext\n1\tFirst\tHello world\n2\tSecond\tHi there")
    records = load_records(str(p), "tsv", {})
    assert len(records) == 2
    assert records[0]["id"] == "1"
    assert records[0]["title"] == "First"
    assert records[0]["text"] == "Hello world"


def test_tsv_preview(tmp_path):
    p = tmp_path / "a.tsv"
    p.write_text("id\ttitle\ttext\n1\tFirst\tHello\n2\tSecond\tHi\n3\tThird\tHey\n4\tFourth\tHola\n5\tFifth\tBye")
    preview = preview_records(str(p), "tsv", {}, max_rows=3)
    assert len(preview) == 3


def test_json_load_array(tmp_path):
    p = tmp_path / "a.json"
    p.write_text('[{"id": "1", "t": "a"}, {"id": "2", "t": "b"}]')
    records = load_records(str(p), "json", {})
    assert len(records) == 2
    assert records[0]["id"] == "1"
    assert records[0]["t"] == "a"


def test_json_load_object_with_array(tmp_path):
    p = tmp_path / "a.json"
    p.write_text('{"items": [{"id": 1, "name": "x"}, {"id": 2, "name": "y"}]}')
    records = load_records(str(p), "json", {})
    assert len(records) == 2
    assert records[0]["id"] == 1
    assert records[0]["name"] == "x"


def test_json_load_single_object(tmp_path):
    p = tmp_path / "a.json"
    p.write_text('{"id": 1, "name": "only"}')
    records = load_records(str(p), "json", {})
    assert len(records) == 1
    assert records[0]["id"] == 1
    assert records[0]["name"] == "only"


def test_jsonl_load(tmp_path):
    p = tmp_path / "a.jsonl"
    p.write_text('{"id": "1", "text": "first"}\n{"id": "2", "text": "second"}')
    records = load_records(str(p), "jsonl", {})
    assert len(records) == 2
    assert records[0]["id"] == "1"
    assert records[1]["text"] == "second"


def test_json_malformed(tmp_path):
    p = tmp_path / "a.json"
    p.write_text("{ invalid json")
    with pytest.raises(ValueError, match="parse error"):
        load_records(str(p), "json", {})


def test_jsonl_malformed_line(tmp_path):
    p = tmp_path / "a.jsonl"
    p.write_text('{"ok": true}\n{broken}\n{"ok": false}')
    with pytest.raises(ValueError, match="line"):
        load_records(str(p), "jsonl", {})
