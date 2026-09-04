#!/usr/bin/env python3
"""Drive LibreOffice Impress through UNO. MIT licensed."""

from __future__ import annotations

import json
import sys
import time


def fail(reason: str, code: int = 1) -> None:
    print(json.dumps({"ok": False, "reason": reason}, ensure_ascii=False))
    raise SystemExit(code)


def ok(backend: str) -> None:
    print(json.dumps({"ok": True, "backend": backend}, ensure_ascii=False))


def connect(urls: list[str]):
    import uno

    local = uno.getComponentContext()
    resolver = local.ServiceManager.createInstanceWithContext(
        "com.sun.star.bridge.UnoUrlResolver", local
    )
    last = None
    for url in urls:
        try:
            return resolver.resolve(url)
        except Exception as exc:  # NoConnectException and friends
            last = exc
    raise last if last else RuntimeError("no-uno-url")


def documents(ctx):
    desktop = ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
    enum = desktop.getComponents().createEnumeration()
    found = []
    while enum.hasMoreElements():
        found.append(enum.nextElement())
    return found


def slideshow_controller(doc):
    try:
        presentation = doc.getPresentation()
    except Exception:
        return None
    controller = presentation.getController()
    if controller is not None:
        return controller
    try:
        presentation.start()
    except Exception:
        return None
    for _ in range(25):
        time.sleep(0.12)
        controller = presentation.getController()
        if controller is not None:
            return controller
    return None


def run_action(controller, action: str, index: int) -> None:
    if action == "next":
        controller.gotoNextEffect()
    elif action == "prev":
        controller.gotoPreviousEffect()
    elif action == "first":
        controller.gotoFirstSlide()
    elif action == "last":
        controller.gotoLastSlide()
    elif action == "goto":
        controller.gotoSlideIndex(index - 1)
    elif action == "start":
        return
    elif action == "stop":
        try:
            controller.exitSlideShow()
        except Exception:
            pass
    else:
        fail("bad-action", 2)


def main(argv: list[str]) -> None:
    if len(argv) < 2:
        fail("missing-action", 2)
    action = argv[1]
    index = 1
    if action == "goto":
        if len(argv) < 3:
            fail("missing-index", 2)
        try:
            index = int(argv[2])
        except ValueError:
            fail("bad-index", 2)
        if index < 1 or index > 9999:
            fail("bad-index", 2)

    urls = [
        "uno:socket,host=127.0.0.1,port=2002;urp;StarOffice.ComponentContext",
        "uno:socket,host=localhost,port=2002;urp;StarOffice.ComponentContext",
    ]
    try:
        ctx = connect(urls)
    except Exception:
        fail("no-uno")

    controller = None
    for doc in documents(ctx):
        controller = slideshow_controller(doc)
        if controller is not None:
            break
    if controller is None:
        fail("no-impress")

    try:
        run_action(controller, action, index)
    except Exception as exc:
        fail(str(exc))
    ok("impress")


if __name__ == "__main__":
    main(sys.argv)
