"""catalog.json'ı v3 şemasına ve şemanın anlatamadığı kurallara göre denetler.

    python tools/validate.py catalog.json

Hata varsa çıkış kodu 1'dir; Pages iş akışı bu durumda yayınlamaz, böylece bozuk bir
katalog uygulamalara hiç ulaşmaz. Uyarılar (eksik çeviri, SHA-256'sı olmayan dosya…)
yayını durdurmaz.
"""
import json
import os
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = ROOT / "schema" / "catalog.v3.schema.json"
TEXT_FIELDS = ("name", "subtitle", "description")


def schema_errors(catalog: dict) -> list[str]:
    validator = Draft202012Validator(json.loads(SCHEMA.read_text(encoding="utf-8")))
    messages = []
    for error in sorted(validator.iter_errors(catalog), key=lambda e: list(e.absolute_path)):
        where = "/".join(str(part) for part in error.absolute_path) or "(kök)"
        messages.append(f"{where}: {_explain(error)}")
    return messages


def _explain(error) -> str:
    """oneOf/anyOf hatalarında jsonschema'nın genel mesajı yerine en anlamlı alt hatayı gösterir."""
    if error.context:
        best = min(error.context, key=lambda e: len(list(e.absolute_path)) * -1)
        return best.message
    return error.message


def rule_errors_and_warnings(catalog: dict, root: Path) -> tuple[list[str], list[str]]:
    errors, warnings = [], []
    languages = catalog.get("languages") or []
    default_lang = languages[0] if languages else None
    seen = set()
    for index, app in enumerate(catalog.get("apps") or []):
        if not isinstance(app, dict):
            continue
        app_id = app.get("id") or f"apps/{index}"
        if app_id in seen:
            errors.append(f"{app_id}: bu kimlik katalogda birden fazla kez geçiyor.")
        seen.add(app_id)

        for path in _media_paths(app):
            if not path.startswith("http") and not (root / path).is_file():
                errors.append(f"{app_id}: görsel repoda yok: {path}")

        if app.get("hidden"):
            continue   # ör. CLD Hub'ın kendi kaydı; mağazada görünmez
        for field in TEXT_FIELDS:
            value = app.get(field)
            if isinstance(value, dict):
                missing = [lang for lang in languages if not value.get(lang)]
                if default_lang in missing:
                    warnings.append(f"{app_id}: {field} varsayılan dilde ({default_lang}) yok.")
                elif missing:
                    warnings.append(f"{app_id}: {field} çevirisi eksik: {', '.join(missing)}")
        platforms = (app.get("release") or {}).get("platforms") or {}
        for platform, entry in platforms.items():
            if isinstance(entry, dict) and entry.get("url") and not entry.get("sha256") \
                    and app.get("status") == "released":
                warnings.append(f"{app_id}: {platform} dosyasının SHA-256'sı yok (indirme doğrulanamaz).")

    collection_ids = set()
    for index, collection in enumerate(catalog.get("collections") or []):
        if not isinstance(collection, dict):
            continue
        cid = collection.get("id") or f"collections/{index}"
        if cid in collection_ids:
            errors.append(f"Koleksiyon {cid}: bu kimlik birden fazla kez geçiyor.")
        collection_ids.add(cid)
        unknown = [a for a in collection.get("apps") or [] if isinstance(a, str) and a not in seen]
        if unknown:
            warnings.append(f"Koleksiyon {cid}: katalogda olmayan uygulama: {', '.join(unknown)} (atlanır).")
        title = collection.get("title")
        if isinstance(title, dict):
            missing = [lang for lang in languages if not title.get(lang)]
            if missing:
                warnings.append(f"Koleksiyon {cid}: başlık çevirisi eksik: {', '.join(missing)}")
    return errors, warnings


def _media_paths(app: dict):
    media = app.get("media") if isinstance(app.get("media"), dict) else {}
    for key in ("logo", "cover"):
        if isinstance(media.get(key), str):
            yield media[key]
    for shots in (media.get("screenshots") or {}).values() if isinstance(media.get("screenshots"), dict) else []:
        for shot in shots if isinstance(shots, list) else []:
            url = shot.get("url") if isinstance(shot, dict) else shot
            if isinstance(url, str):
                yield url


def main(path: str) -> int:
    catalog_path = Path(path)
    try:
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as ex:
        print(f"{path}: okunamadı: {ex}")
        return 1
    errors = schema_errors(catalog)
    rule_errors, warnings = rule_errors_and_warnings(catalog, catalog_path.resolve().parent)
    errors += rule_errors

    in_actions = os.environ.get("GITHUB_ACTIONS") == "true"
    for message in warnings:
        print(f"::warning title=Katalog::{message}" if in_actions else f"uyarı: {message}")
    for message in errors:
        print(f"::error title=Katalog::{message}" if in_actions else f"HATA: {message}")
    apps = len(catalog.get("apps") or []) if isinstance(catalog, dict) else 0
    print(f"{path}: {apps} uygulama, {len(errors)} hata, {len(warnings)} uyarı")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "catalog.json"))
