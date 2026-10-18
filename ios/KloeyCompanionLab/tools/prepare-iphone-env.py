#!/usr/bin/env python3
"""Prepare private credentials for the local iPhone conversation server."""

from __future__ import annotations

import getpass
import os
import re
import secrets
import sys
import tempfile
from pathlib import Path


PROVIDER_KEYS = ("OPENAI_API_KEY", "ELEVENLABS_API_KEY")
TOKEN_KEY = "HARNESS_TOKEN"
SAFE_VALUE = re.compile(r"^[A-Za-z0-9._=-]+$")


def active_values(lines: list[str], key: str) -> list[str]:
    prefix = re.compile(rf"^\s*{re.escape(key)}\s*=\s*(.*)$")
    return [match.group(1).strip().strip("\"'") for line in lines if (match := prefix.match(line))]


def set_value(lines: list[str], key: str, value: str) -> None:
    prefix = re.compile(rf"^\s*{re.escape(key)}\s*=.*$")
    replacement = f"{key}={value}"
    indexes = [index for index, line in enumerate(lines) if prefix.match(line)]
    if indexes:
        for index in indexes:
            lines[index] = replacement
    else:
        if lines and lines[-1].strip():
            lines.append("")
        lines.append(replacement)


def require_secret(key: str) -> str:
    if not sys.stdin.isatty():
        raise RuntimeError(
            f"{key} is missing. Run this script from Terminal so it can ask for the key privately, "
            "or add it to the ignored character-harness/.env file."
        )
    while True:
        value = getpass.getpass(f"Enter {key} (input hidden): ").strip()
        if value and SAFE_VALUE.fullmatch(value):
            return value
        print("That value is empty or contains characters that need .env quoting. Please retry.")


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: prepare-iphone-env.py <character-harness-root>", file=sys.stderr)
        return 2

    root = Path(sys.argv[1]).resolve()
    env_file = root / ".env"
    example = root / ".env.example"
    if not (root / "runtime/src/main.ts").is_file() or not example.is_file():
        print("The character-harness checkout or its .env.example is missing.", file=sys.stderr)
        return 1
    if env_file.is_symlink():
        raise RuntimeError("Refusing to write through a symlink at character-harness/.env.")

    original_exists = env_file.exists()
    content = env_file.read_text() if original_exists else example.read_text()
    lines = content.splitlines()
    changed = not original_exists

    for key in PROVIDER_KEYS:
        values = active_values(lines, key)
        if values and values[-1]:
            continue
        set_value(lines, key, require_secret(key))
        changed = True

    token_values = active_values(lines, TOKEN_KEY)
    token = token_values[-1] if token_values else ""
    if token and not re.fullmatch(r"[A-Za-z0-9_-]+", token):
        raise RuntimeError("HARNESS_TOKEN must contain only letters, digits, underscores or hyphens.")
    if not token:
        set_value(lines, TOKEN_KEY, secrets.token_hex(16))
        changed = True

    if changed:
        fd, temporary = tempfile.mkstemp(prefix=".env.", dir=root)
        try:
            os.fchmod(fd, 0o600)
            with os.fdopen(fd, "w") as destination:
                destination.write("\n".join(lines).rstrip() + "\n")
            os.replace(temporary, env_file)
            os.chmod(env_file, 0o600)
        except BaseException:
            try:
                os.close(fd)
            except OSError:
                pass
            try:
                os.unlink(temporary)
            except FileNotFoundError:
                pass
            raise
        print("Saved the required provider keys and stable session token to the ignored .env file (permissions 600).")
    else:
        os.chmod(env_file, 0o600)
        print("The local .env already has the required provider keys and stable session token.")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError) as error:
        print(f"Setup stopped: {error}", file=sys.stderr)
        raise SystemExit(1)
