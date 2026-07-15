#!/usr/bin/env python3
"""
license_manager.py — Lớp quản lý license cho app Python: đọc/lưu, kiểm tra khởi động,
kích hoạt, cổng tính năng. Bọc quanh license_client.py.
"""
import os
import sys
from pathlib import Path

from license_client import get_machine_id, verify_license

# ==== CẤU HÌNH APP — chỉnh theo sản phẩm/bản build ====
APP_VERSION = "2.0"
APP_RELEASE_DATE = "2026-08-01"   # NGÀY PHÁT HÀNH bản build này (không phải hôm nay)
APP_NAME = "MyApp"
APP_PRODUCT = "myapp-pro"   # mã sản phẩm — đối chiếu với lic["product"] nếu license có gắn product


def license_path() -> Path:
    """Nơi lưu license theo OS (tương đương %APPDATA% trên Windows)."""
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", Path.home()))
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    d = base / APP_NAME
    d.mkdir(parents=True, exist_ok=True)
    return d / "license.dat"


def save_license(lic_str: str):
    license_path().write_text(lic_str.strip(), encoding="utf-8")


def load_license():
    p = license_path()
    return p.read_text(encoding="utf-8").strip() if p.exists() else None


def clear_license():
    p = license_path()
    if p.exists():
        p.unlink()


def evaluate() -> dict:
    """Trạng thái hiện tại: {'state': 'active'|'unactivated'|'invalid', 'machine_id', 'lic', 'why'}"""
    mid = get_machine_id()
    lic_str = load_license()
    if not lic_str:
        return {"state": "unactivated", "machine_id": mid, "lic": None, "why": "chua_kich_hoat"}
    r = verify_license(lic_str, mid, APP_VERSION, APP_RELEASE_DATE, APP_PRODUCT)
    if r["ok"]:
        return {"state": "active", "machine_id": mid, "lic": r["lic"], "why": None}
    return {"state": "invalid", "machine_id": mid, "lic": r["lic"], "why": r["why"]}


def activate(lic_str: str) -> dict:
    """Khách dán license -> verify -> nếu OK thì lưu."""
    mid = get_machine_id()
    r = verify_license(lic_str, mid, APP_VERSION, APP_RELEASE_DATE, APP_PRODUCT)
    if r["ok"]:
        save_license(lic_str)
        return {"ok": True, "lic": r["lic"]}
    return {"ok": False, "why": r["why"]}


def has_feature(feature: str) -> bool:
    # Fail-closed: license active nhưng thiếu/hỏng field "features" thì KHÔNG
    # cấp quyền (trước đây mặc định cấp full quyền nếu thiếu field này).
    s = evaluate()
    if s["state"] != "active":
        return False
    feats = s["lic"].get("features")
    return feature in feats if isinstance(feats, list) else False


def require_license_or_exit():
    """Gọi đầu chương trình. Nếu chưa kích hoạt -> hướng dẫn và thoát."""
    s = evaluate()
    if s["state"] == "active":
        return s["lic"]
    print("=" * 50)
    print(" CHƯA KÍCH HOẠT" if s["state"] == "unactivated" else f" LICENSE LỖI: {s['why']}")
    print(f" Mã máy của bạn: {s['machine_id']}")
    print(" Gửi mã máy cho nhà cung cấp để nhận mã kích hoạt,")
    print(" sau đó chạy:  python -m license_manager activate <chuỗi_license>")
    print("=" * 50)
    sys.exit(1)


if __name__ == "__main__":
    # CLI tiện: python license_manager.py            -> in trạng thái + mã máy
    #           python license_manager.py activate X  -> kích hoạt bằng chuỗi X
    if len(sys.argv) >= 3 and sys.argv[1] == "activate":
        print(activate(sys.argv[2]))
    else:
        print(evaluate())
