#!/usr/bin/env python3
"""Build the native PresenceTracker replay runner."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
NATIVE_DIR = Path(__file__).resolve().parent
RUNNER_CPP = NATIVE_DIR / "tracker_runner.cpp"
TRACKER_CPP = ROOT / "components" / "radar_api_server" / "presence_tracker.cpp"
INCLUDE_DIR = ROOT / "components" / "radar_api_server"
OUT_EXE = NATIVE_DIR / ("tracker_runner.exe" if os.name == "nt" else "tracker_runner")


def cmd_quote(value: str) -> str:
    if not value or any(ch.isspace() for ch in value):
        return '"' + value.replace('"', r'\"') + '"'
    return value


def find_msvc_with_vswhere() -> str | None:
    vswhere = Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")) / "Microsoft Visual Studio" / "Installer" / "vswhere.exe"
    if not vswhere.exists():
        return None

    completed = subprocess.run(
        [
            str(vswhere),
            "-latest",
            "-products",
            "*",
            "-requires",
            "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
            "-property",
            "installationPath",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    install_path = completed.stdout.strip()
    if not install_path:
        return None

    vsdevcmd = Path(install_path) / "Common7" / "Tools" / "VsDevCmd.bat"
    return str(vsdevcmd) if vsdevcmd.exists() else None


def find_compiler() -> tuple[str, str] | None:
    requested = os.environ.get("CXX")
    if requested:
        return requested, "gcc-like"

    cl = shutil.which("cl")
    if cl:
        return cl, "msvc"

    msvc = find_msvc_with_vswhere()
    if msvc:
        return msvc, "msvc-vsdevcmd"

    for name in ("g++", "clang++"):
        path = shutil.which(name)
        if path:
            return path, "gcc-like"

    return None


def build_command(compiler: str, kind: str) -> list[str]:
    msvc_args = [
        "cl",
        "/nologo",
        "/std:c++17",
        "/EHsc",
        "/O2",
        f"/I{INCLUDE_DIR}",
        str(RUNNER_CPP),
        str(TRACKER_CPP),
        f"/Fe:{OUT_EXE}",
    ]

    if kind == "msvc":
        return [compiler, *msvc_args[1:]]

    if kind == "msvc-vsdevcmd":
        batch = NATIVE_DIR / "_build_tracker_runner.cmd"
        compile_command = " ".join(cmd_quote(arg) for arg in msvc_args)
        batch.write_text(
            "\n".join(
                [
                    "@echo off",
                    f'call "{compiler}" -arch=x64 -host_arch=x64',
                    "if errorlevel 1 exit /b %errorlevel%",
                    compile_command,
                    "exit /b %errorlevel%",
                    "",
                ]
            ),
            encoding="utf-8",
        )
        return [
            "cmd",
            "/c",
            str(batch),
        ]

    return [
        compiler,
        "-std=c++17",
        "-O2",
        f"-I{INCLUDE_DIR}",
        str(RUNNER_CPP),
        str(TRACKER_CPP),
        "-o",
        str(OUT_EXE),
    ]


def main() -> int:
    compiler = find_compiler()
    if compiler is None:
        print(
            "error: no host C++ compiler found. Install Visual Studio Build Tools, "
            "MinGW g++, or clang++, then rerun this script.",
            file=sys.stderr,
        )
        return 1

    compiler_path, kind = compiler
    command = build_command(compiler_path, kind)
    print(" ".join(command))
    completed = subprocess.run(command, cwd=ROOT)
    if completed.returncode != 0:
        return completed.returncode

    print(f"built: {OUT_EXE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
