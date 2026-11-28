from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import win32com.client
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = Path(__file__).resolve().parent
PPTX_PATH = OUT_DIR / "QoreSentinel_Project_Explained.pptx"
SCREEN_DIR = OUT_DIR

W, H = 13.333, 7.5
BG = (6, 12, 24)
PANEL = (13, 24, 42)
PANEL2 = (17, 32, 54)
PANEL3 = (20, 40, 65)
WHITE = (239, 246, 255)
MUTED = (153, 174, 199)
CYAN = (48, 213, 245)
BLUE = (75, 133, 255)
PURPLE = (159, 121, 255)
GREEN = (70, 219, 165)
AMBER = (255, 190, 84)
RED = (255, 113, 128)
LINE = (43, 64, 92)

PP_LAYOUT_BLANK = 12
PP_ACTION_HYPERLINK = 7
PP_MOUSE_CLICK = 1
PP_ALIGN_LEFT = 1
PP_ALIGN_CENTER = 2
PP_ALIGN_RIGHT = 3
MSO_TEXT_ORIENT_H = 1
MSO_SHAPE_RECT = 1
MSO_SHAPE_ROUND_RECT = 5
MSO_SHAPE_OVAL = 9
MSO_SHAPE_DIAMOND = 4
MSO_SHAPE_TRIANGLE = 7


def rgb(color: tuple[int, int, int]) -> int:
    r, g, b = color
    return r + (g << 8) + (b << 16)


def set_fill(shape, color, transparency=0):
    shape.Fill.Visible = True
    shape.Fill.Solid()
    shape.Fill.ForeColor.RGB = rgb(color)
    shape.Fill.Transparency = transparency


def set_line(shape, color=LINE, width=1, transparency=0):
    shape.Line.Visible = True
    shape.Line.ForeColor.RGB = rgb(color)
    shape.Line.Weight = width
    shape.Line.Transparency = transparency


def add_box(slide, x, y, w, h, fill=PANEL, stroke=LINE, radius=True, line_width=0.8):
    kind = MSO_SHAPE_ROUND_RECT if radius else MSO_SHAPE_RECT
    shape = slide.Shapes.AddShape(kind, x * 72, y * 72, w * 72, h * 72)
    set_fill(shape, fill)
    if stroke:
        set_line(shape, stroke, line_width)
    else:
        shape.Line.Visible = False
    return shape


def add_text(slide, x, y, w, h, text, size=14, color=WHITE, bold=False,
             align=PP_ALIGN_LEFT, font="Aptos", margin=0, italic=False,
             valign=1, fit=False):
    shape = slide.Shapes.AddTextbox(MSO_TEXT_ORIENT_H, x * 72, y * 72, w * 72, h * 72)
    tf = shape.TextFrame
    tf.MarginLeft = margin * 72
    tf.MarginRight = margin * 72
    tf.MarginTop = margin * 72
    tf.MarginBottom = margin * 72
    tf.WordWrap = True
    tf.VerticalAnchor = valign
    tr = tf.TextRange
    tr.Text = text
    tr.Font.Name = font
    tr.Font.Size = size
    tr.Font.Bold = bold
    tr.Font.Italic = italic
    tr.Font.Color.RGB = rgb(color)
    tr.ParagraphFormat.Alignment = align
    if fit:
        tf.AutoSize = 2
    shape.Line.Visible = False
    shape.Fill.Visible = False
    return shape


def add_line(slide, x1, y1, x2, y2, color=LINE, width=1.2):
    line = slide.Shapes.AddLine(x1 * 72, y1 * 72, x2 * 72, y2 * 72)
    line.Line.ForeColor.RGB = rgb(color)
    line.Line.Weight = width
    return line


def add_dot(slide, x, y, d, color, stroke=None):
    shape = slide.Shapes.AddShape(MSO_SHAPE_OVAL, x * 72, y * 72, d * 72, d * 72)
    set_fill(shape, color)
    if stroke:
        set_line(shape, stroke, 1)
    else:
        shape.Line.Visible = False
    return shape


def add_pill(slide, x, y, w, text, color=CYAN, fill=(10, 38, 56), size=9):
    add_box(slide, x, y, w, 0.29, fill, color, True, 0.6)
    add_text(slide, x + 0.07, y + 0.015, w - 0.14, 0.25, text, size, color, True, PP_ALIGN_CENTER)


def add_button(slide, x, y, w, text, fill=CYAN, text_color=BG, size=10, url=None):
    shape = add_box(slide, x, y, w, 0.43, fill, fill, True, 0.6)
    label = add_text(slide, x + 0.08, y + 0.04, w - 0.16, 0.32, text, size, text_color, True, PP_ALIGN_CENTER)
    if url:
        set_external_link(shape, url)
        set_external_link(label, url)
    return shape


def set_external_link(shape, url):
    try:
        action = shape.ActionSettings(PP_MOUSE_CLICK)
        action.Action = PP_ACTION_HYPERLINK
        action.Hyperlink.Address = url
    except Exception as exc:
        print(f"External link could not be added for {url}: {exc}")


def set_slide_link(shape, target):
    try:
        action = shape.ActionSettings(PP_MOUSE_CLICK)
        action.Action = PP_ACTION_HYPERLINK
        action.Hyperlink.Address = ""
        title = target.Shapes.Title.TextFrame.TextRange.Text if target.Shapes.HasTitle else ""
        action.Hyperlink.SubAddress = f"{target.SlideID},{target.SlideIndex},{title}"
    except Exception as exc:
        print(f"Internal link could not be added: {exc}")


def add_click_overlay(slide, x, y, w, h, target):
    overlay = slide.Shapes.AddShape(MSO_SHAPE_RECT, x * 72, y * 72, w * 72, h * 72)
    set_fill(overlay, BG, 1.0)
    overlay.Line.Visible = False
    set_slide_link(overlay, target)
    return overlay


def fit_picture(slide, path: Path, x, y, w, h, label="", alt_text=None):
    path = Path(path)
    img = Image.open(path)
    iw, ih = img.size
    target = w / h
    source = iw / ih
    if source > target:
        crop_w = int(ih * target)
        left = max(0, (iw - crop_w) // 2)
        img = img.crop((left, 0, left + crop_w, ih))
    else:
        crop_h = int(iw / target)
        top = max(0, (ih - crop_h) // 2)
        img = img.crop((0, top, iw, top + crop_h))
    prepared = OUT_DIR / f"crop_{path.stem}_{int(w*100)}x{int(h*100)}.png"
    img.save(prepared)
    frame = add_box(slide, x - 0.025, y - 0.025, w + 0.05, h + 0.05, PANEL, LINE, True, 0.8)
    pic = slide.Shapes.AddPicture(str(prepared), False, True, x * 72, y * 72, w * 72, h * 72)
    pic.AlternativeText = alt_text or label or "QoreSentinel product screenshot"
    if label:
        add_text(slide, x, y + h + 0.075, w, 0.24, label, 8.5, MUTED, False)
    return pic


def bg(slide, accent=CYAN):
    slide.FollowMasterBackground = False
    slide.Background.Fill.Solid()
    slide.Background.Fill.ForeColor.RGB = rgb(BG)
    base = slide.Shapes.AddShape(MSO_SHAPE_RECT, 0, 0, W * 72, H * 72)
    set_fill(base, BG)
    base.Line.Visible = False
    base.ZOrder(1)
    # quiet top accent / section rail
    add_box(slide, 0, 0, W, 0.035, accent, accent, False, 0)
    # low-opacity decorative light blocks
    add_box(slide, 11.95, 0.35, 0.82, 0.82, PANEL, None, True)
    add_box(slide, 12.25, 0.65, 0.20, 0.20, accent, None, True)


def add_brand(slide):
    add_box(slide, 0.46, 0.42, 0.35, 0.35, CYAN, CYAN, True, 0.5)
    add_text(slide, 0.46, 0.435, 0.35, 0.30, "Q", 14, BG, True, PP_ALIGN_CENTER)
    add_text(slide, 0.91, 0.40, 1.65, 0.19, "QORE SENTINEL", 10, WHITE, True)
    add_text(slide, 0.91, 0.60, 1.8, 0.16, "PROJECT WALKTHROUGH", 7, MUTED, True)


def add_footer(slide, slides, active, external_url):
    add_line(slide, 0.48, 7.02, 12.85, 7.02, LINE, 0.6)
    add_text(slide, 0.52, 7.09, 1.58, 0.16, "CLICK A NUMBER TO JUMP", 7.2, MUTED, True)
    for idx, target in enumerate(slides, start=1):
        x = 2.36 + (idx - 1) * 0.32
        fill = CYAN if idx == active else PANEL2
        text_color = BG if idx == active else MUTED
        shape = add_box(slide, x, 7.075, 0.24, 0.24, fill, fill if idx == active else LINE, True, 0.4)
        num = add_text(slide, x, 7.085, 0.24, 0.18, str(idx), 7.5, text_color, True, PP_ALIGN_CENTER)
        set_slide_link(shape, target)
        set_slide_link(num, target)
    live = add_box(slide, 11.13, 7.07, 1.62, 0.27, PANEL2, CYAN, True, 0.6)
    live_label = add_text(slide, 11.20, 7.10, 1.47, 0.18, "OPEN LIVE DEMO ↗", 7.2, CYAN, True, PP_ALIGN_CENTER)
    set_external_link(live, external_url)
    set_external_link(live_label, external_url)


def add_header(slide, kicker, title, subtitle, accent=CYAN):
    add_brand(slide)
    add_text(slide, 0.50, 1.00, 4.0, 0.18, kicker.upper(), 8, accent, True)
    add_text(slide, 0.50, 1.26, 11.8, 0.55, title, 26, WHITE, True)
    if subtitle:
        add_text(slide, 0.53, 1.83, 11.6, 0.42, subtitle, 11.5, MUTED)


def icon_badge(slide, x, y, label, color=CYAN):
    add_dot(slide, x, y, 0.38, color)
    add_text(slide, x, y + 0.04, 0.38, 0.28, label, 11, BG, True, PP_ALIGN_CENTER)


def small_card(slide, x, y, w, h, number, title, body, color=CYAN):
    add_box(slide, x, y, w, h, PANEL, LINE, True, 0.7)
    icon_badge(slide, x + 0.17, y + 0.17, number, color)
    add_text(slide, x + 0.67, y + 0.16, w - 0.82, 0.30, title, 12, WHITE, True)
    add_text(slide, x + 0.19, y + 0.66, w - 0.38, h - 0.78, body, 9.4, MUTED)


def new_deck():
    app = win32com.client.DispatchEx("PowerPoint.Application")
    app.Visible = True
    pres = app.Presentations.Add()
    pres.PageSetup.SlideWidth = W * 72
    pres.PageSetup.SlideHeight = H * 72
    slides = [pres.Slides.Add(i, PP_LAYOUT_BLANK) for i in range(1, 10)]
    pres.SlideMaster.HeadersFooters.Footer.Visible = False
    return app, pres, slides


def build():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    app, pres, slides = new_deck()
    demo_url = "https://qoresentinel-fkbp.onrender.com/"

    # 1 — Cover
    s = slides[0]
    bg(s, CYAN)
    add_brand(s)
    add_pill(s, 0.55, 1.22, 2.68, "POST-QUANTUM GRANT PLATFORM", CYAN, (10, 31, 48), 8)
    add_text(s, 0.55, 1.78, 5.35, 1.55, "QoreSentinel", 39, WHITE, True)
    add_text(s, 0.58, 3.02, 5.12, 0.90, "A safer path from\ngrant request to payout", 23, CYAN, True)
    add_text(s, 0.60, 4.13, 4.78, 0.66,
             "A guided tour of the product, seven-agent review, cryptographic decision checks, and QoreChain settlement flow.",
             12, MUTED)
    add_pill(s, 0.58, 5.10, 1.30, "7 REVIEW AGENTS", CYAN, PANEL, 8)
    add_pill(s, 2.00, 5.10, 1.44, "ML-DSA-87", PURPLE, PANEL, 8)
    add_pill(s, 3.57, 5.10, 1.54, "DIANA · 9800", GREEN, PANEL, 8)
    add_button(s, 0.58, 5.69, 1.90, "Open live demo  ↗", CYAN, BG, 9.4, demo_url)
    navbtn = add_box(s, 2.65, 5.69, 1.86, 0.43, PANEL2, LINE, True)
    walk_label = add_text(s, 2.76, 5.75, 1.64, 0.28, "Start the walkthrough  →", 8.7, WHITE, True, PP_ALIGN_CENTER)
    set_slide_link(navbtn, slides[1])
    set_slide_link(walk_label, slides[1])
    fit_picture(s, SCREEN_DIR / "landing.png", 6.10, 1.38, 6.62, 3.73, "Real screenshot of the deployed QoreSentinel landing overview")
    add_box(s, 6.10, 5.49, 6.62, 0.70, PANEL, LINE, True, 0.6)
    for i, (num, label, color) in enumerate([
        ("01", "APPLY", CYAN), ("02", "REVIEW", BLUE), ("03", "SIGN", PURPLE), ("04", "SETTLE", GREEN)
    ]):
        x = 6.35 + i * 1.60
        add_dot(s, x, 5.67, 0.32, color)
        add_text(s, x, 5.72, 0.32, 0.19, num, 7, BG, True, PP_ALIGN_CENTER)
        add_text(s, x + 0.42, 5.71, 1.05, 0.20, label, 8, WHITE, True)
        if i < 3:
            add_line(s, x + 1.23, 5.83, x + 1.52, 5.83, LINE, 1.2)
    add_text(s, 0.58, 6.59, 5.4, 0.23, "PROJECT EXPLAINER  ·  9 SLIDES  ·  CLICKABLE CHAPTER NAVIGATION", 8, MUTED, True)
    add_footer(s, slides, 1, demo_url)

    # 2 — Clickable overview
    s = slides[1]
    bg(s, BLUE)
    add_header(s, "01 · The short version", "One application. Four guarded stages.",
               "Use the cards as a clickable table of contents; each one jumps to the deeper explanation.", BLUE)
    cards = [
        (0.60, "01", "A student applies", "Identity, project, requested QOR, milestones, and supporting documents enter the platform.", CYAN, 3),
        (3.73, "02", "Rules review it", "Seven specialized agents check evidence, eligibility, duplication, budget, and policy.", BLUE, 5),
        (6.86, "03", "A decision is signed", "The coordinator creates a canonical decision payload and applies an ML-DSA-87 signature.", PURPLE, 6),
        (9.99, "04", "Payment is verified", "Live milestones need wallet authorization and a matching on-chain receipt.", GREEN, 8),
    ]
    for x, number, title, body, color, dest in cards:
        card = add_box(s, x, 2.72, 2.72, 2.25, PANEL, color, True, 1.1)
        icon_badge(s, x + 0.20, 2.94, number, color)
        add_text(s, x + 0.20, 3.54, 2.31, 0.39, title, 14, WHITE, True)
        add_text(s, x + 0.20, 4.02, 2.31, 0.64, body, 9.4, MUTED)
        add_text(s, x + 0.20, 4.70, 2.20, 0.18, "CLICK TO EXPLORE  ↗", 7.5, color, True)
        add_click_overlay(s, x, 2.72, 2.72, 2.25, slides[dest - 1])
    for x in (3.38, 6.51, 9.64):
        add_text(s, x, 3.60, 0.27, 0.38, "→", 19, MUTED, True, PP_ALIGN_CENTER)
    add_box(s, 0.60, 5.42, 12.11, 0.87, (10, 27, 43), LINE, True, 0.7)
    add_text(s, 0.87, 5.63, 2.05, 0.25, "THE CORE RULE", 9, AMBER, True)
    add_text(s, 2.75, 5.57, 9.55, 0.38,
             "AI can explain outcomes; deterministic policy, signatures, wallet permissions, and chain receipts govern execution.",
             13, WHITE, True)
    add_footer(s, slides, 2, demo_url)

    # 3 — Real product screenshots
    s = slides[2]
    bg(s, CYAN)
    add_header(s, "02 · Product tour", "Three real screens, three product jobs.",
               "Screenshots captured from the deployed app. Click any screenshot to open that live page.", CYAN)
    shot_landing = fit_picture(s, SCREEN_DIR / "landing.png", 0.62, 2.52, 7.40, 4.02,
                               alt_text="Landing overview — product promise and core security principles")
    shot_register = fit_picture(s, SCREEN_DIR / "register.png", 8.27, 2.52, 4.43, 1.84,
                                alt_text="Student registration — student account fields")
    shot_assistant = fit_picture(s, SCREEN_DIR / "assistant.png", 8.27, 4.84, 4.43, 1.70,
                                 alt_text="Help Assistant — read-only product guidance")
    # Clickable screenshot regions
    for screenshot in (shot_landing, shot_register, shot_assistant):
        set_external_link(screenshot, demo_url)
    add_text(s, 0.65, 6.64, 7.34, 0.20, "LANDING OVERVIEW  ·  LIVE DEPLOYMENT", 8, CYAN, True)
    add_text(s, 8.31, 4.48, 4.3, 0.19, "STUDENT ACCOUNT ENTRY", 8, BLUE, True)
    add_text(s, 8.31, 6.64, 4.3, 0.19, "READ-ONLY HELP ASSISTANT", 8, PURPLE, True)
    add_footer(s, slides, 3, demo_url)

    # 4 — Workflow
    s = slides[3]
    bg(s, BLUE)
    add_header(s, "03 · Applicant journey", "From a proposal to a reviewable record.",
               "Each stage has a clear owner and creates data the next stage can check.", BLUE)
    steps = [
        (0.62, 2.62, "1", "Create account", "Student profile and password; account is separate from the wallet.", CYAN),
        (3.77, 2.62, "2", "Choose a pool", "Pool defines category, cap, remaining balance, and evidence needs.", BLUE),
        (6.92, 2.62, "3", "Submit proposal", "Project plan, budget, beneficiary address, milestones, and files.", PURPLE),
        (10.07, 2.62, "4", "Admin reviews", "A reviewer launches the seven-agent pipeline; progress is recorded.", GREEN),
    ]
    for x, y, no, title, body, col in steps:
        add_box(s, x, y, 2.64, 1.82, PANEL, col, True, 1.0)
        add_dot(s, x + 0.18, y + 0.19, 0.36, col)
        add_text(s, x + 0.18, y + 0.24, 0.36, 0.22, no, 10, BG, True, PP_ALIGN_CENTER)
        add_text(s, x + 0.20, y + 0.74, 2.24, 0.31, title, 13.5, WHITE, True)
        add_text(s, x + 0.20, y + 1.13, 2.24, 0.52, body, 9.3, MUTED)
    for x in (3.37, 6.52, 9.67):
        add_text(s, x, 3.25, 0.32, 0.35, "→", 19, MUTED, True, PP_ALIGN_CENTER)
    add_box(s, 0.62, 4.88, 12.09, 1.11, PANEL2, LINE, True, 0.7)
    add_text(s, 0.90, 5.10, 1.9, 0.20, "WHAT GETS STORED", 8.5, CYAN, True)
    add_text(s, 0.90, 5.41, 11.45, 0.31,
             "Application + pool + decision + agent trace + audit records + payment intent + verified transaction receipts",
             12, WHITE, True)
    add_text(s, 0.91, 5.79, 11.3, 0.18, "Runtime persistence: SQLite via better-sqlite3. API validation: Zod schemas.", 8.5, MUTED)
    add_footer(s, slides, 4, demo_url)

    # 5 — Agent pipeline
    s = slides[4]
    bg(s, PURPLE)
    add_header(s, "04 · Seven-agent review", "The review is a sequence of checks—not a chatbot vote.",
               "Each specialist returns structured results. The coordinator approves only when every deterministic gate passes.", PURPLE)
    agent_rows = [
        (0.62, 2.48, "01", "Intake", "Schema + wallet format", CYAN),
        (3.72, 2.48, "02", "Documents", "Hashes + duplicate evidence", BLUE),
        (6.82, 2.48, "03", "Eligibility", "Pool/category + requirements", PURPLE),
        (9.92, 2.48, "04", "Fraud", "Identity/title/wallet/budget", AMBER),
        (0.62, 4.12, "05", "Financial policy", "Pool funds + cap + 3 milestones", AMBER),
        (4.73, 4.12, "06", "Decision coordinator", "Combines checks + ML-DSA sign", GREEN),
        (8.84, 4.12, "07", "Transaction agent", "Verifies scope + sim/live execution", CYAN),
    ]
    for x, y, no, title, detail, col in agent_rows:
        add_box(s, x, y, 2.79 if no not in ("05", "06", "07") else 3.85, 1.15, PANEL, col, True, 0.9)
        add_dot(s, x + 0.16, y + 0.17, 0.32, col)
        add_text(s, x + 0.16, y + 0.21, 0.32, 0.21, no, 8, BG, True, PP_ALIGN_CENTER)
        add_text(s, x + 0.58, y + 0.18, (2.79 if no not in ("05", "06", "07") else 3.85) - 0.75, 0.26, title, 11.2, WHITE, True)
        add_text(s, x + 0.20, y + 0.61, (2.79 if no not in ("05", "06", "07") else 3.85) - 0.4, 0.31, detail, 8.5, MUTED)
    # Flow rails through stages
    for x in (3.48, 6.58, 9.68):
        add_text(s, x, 2.90, 0.22, 0.25, "→", 14, MUTED, True, PP_ALIGN_CENTER)
    add_line(s, 11.54, 3.05, 11.91, 3.05, LINE, 1.1)
    add_line(s, 11.91, 3.05, 11.91, 4.70, LINE, 1.1)
    add_text(s, 4.36, 3.61, 4.55, 0.20, "A failed gate blocks approval and payout", 8.4, RED, True, PP_ALIGN_CENTER)
    add_box(s, 0.62, 5.77, 12.09, 0.67, (42, 28, 24), (107, 72, 44), True, 0.7)
    add_text(s, 0.86, 5.96, 11.62, 0.25,
             "Optional Groq text explains results; it does not participate in this decision pipeline.",
             10, AMBER, True, PP_ALIGN_CENTER)
    add_footer(s, slides, 5, demo_url)

    # 6 — Trust boundary / signed decision
    s = slides[5]
    bg(s, GREEN)
    add_header(s, "05 · Trust and security", "Three independent gates protect the payout.",
               "A valid signature proves the decision payload; it does not replace policy or on-chain receipt verification.", GREEN)
    trust = [
        (0.62, "POLICY", "Eligibility + financial + fraud", "Deterministic checks decide whether the requested amount may proceed.", BLUE),
        (4.73, "SIGNATURE", "Canonical payload + ML-DSA-87", "The coordinator signs the decision using the post-quantum FIPS 204 algorithm.", PURPLE),
        (8.84, "SETTLEMENT", "Scoped authorization + receipt", "The live path checks spend scope and confirms a matching GrantVault event.", GREEN),
    ]
    for x, label, title, body, col in trust:
        add_box(s, x, 2.55, 3.84, 1.80, PANEL, col, True, 1.0)
        add_pill(s, x + 0.18, 2.73, 1.10, label, col, PANEL2, 7.5)
        add_text(s, x + 0.19, 3.18, 3.45, 0.38, title, 13.4, WHITE, True)
        add_text(s, x + 0.19, 3.64, 3.42, 0.50, body, 9.1, MUTED)
    for x in (4.48, 8.59):
        add_text(s, x, 3.22, 0.22, 0.31, "→", 16, MUTED, True, PP_ALIGN_CENTER)
    add_box(s, 0.62, 4.81, 12.06, 0.77, (12, 39, 42), (28, 89, 89), True, 0.8)
    add_text(s, 0.88, 5.04, 11.55, 0.28,
             "ML-DSA-87 signature  ≠  payment receipt   ·   APPROVED  ≠  PAID",
             14, GREEN, True, PP_ALIGN_CENTER)
    add_text(s, 0.81, 5.88, 11.7, 0.34,
             "In demo mode, a simulated execution is clearly labeled and never counted as a verified transfer.",
             10.4, MUTED, False, PP_ALIGN_CENTER)
    add_footer(s, slides, 6, demo_url)

    # 7 — Technology architecture
    s = slides[6]
    bg(s, CYAN)
    add_header(s, "06 · Technology stack", "A web app, guarded API, and verifiable chain boundary.",
               "The API is the orchestrator; the wallet keeps signing authority with the user.", CYAN)
    layers = [
        (0.67, 2.48, 11.96, 0.76, "WEB CLIENT", "React 18 · TypeScript · Vite · Tailwind CSS", CYAN),
        (0.67, 3.44, 11.96, 0.76, "API + AGENTS", "Node.js · Express · TypeScript · Zod · 7 deterministic review agents", BLUE),
        (0.67, 4.40, 11.96, 0.76, "RUNTIME DATA", "SQLite / better-sqlite3 · accounts · pools · applications · decisions · audit + ledger", PURPLE),
        (0.67, 5.36, 11.96, 0.76, "CHAIN + SIGNING", "QoreChain Diana Testnet (9800) · GrantVault · QoreX · ML-DSA-87 · optional Groq explanation", GREEN),
    ]
    for y, _x, w, h, label, detail, col in [(a[1],a[0],a[2],a[3],a[4],a[5],a[6]) for a in layers]:
        add_box(s, 0.67, y, w, h, PANEL, LINE, True, 0.7)
        add_box(s, 0.67, y, 0.18, h, col, col, True, 0.2)
        add_text(s, 0.98, y + 0.11, 2.10, 0.20, label, 8.5, col, True)
        add_text(s, 3.14, y + 0.13, 9.10, 0.26, detail, 11, WHITE, True)
    add_text(s, 0.75, 6.33, 11.75, 0.22,
             "Build / run: npm workspaces · Docker image · Render web service · persistent disk for SQLite",
             9.2, MUTED, False, PP_ALIGN_CENTER)
    add_footer(s, slides, 7, demo_url)

    # 8 — Pool and payment lifecycle
    s = slides[7]
    bg(s, AMBER)
    add_header(s, "07 · Pool and payment lifecycle", "Funding, approval, and payment are different states.",
               "This distinction keeps the dashboard honest about what is on-chain and what is only reserved or simulated.", AMBER)
    status = [
        (0.62, "POOL CREATED", "Admin defines budget, rules, cap, category", CYAN),
        (3.73, "FUNDED", "Live pool activates after receipt verification", BLUE),
        (6.84, "APPROVED", "Decision is signed; amount is reserved", PURPLE),
        (9.95, "PAID", "Milestone receipt + GrantReleased event", GREEN),
    ]
    for i, (x, title, body, col) in enumerate(status):
        add_box(s, x, 2.61, 2.72, 1.48, PANEL, col, True, 0.9)
        add_pill(s, x + 0.16, 2.78, 1.45, f"STATE 0{i+1}", col, PANEL2, 7.2)
        add_text(s, x + 0.18, 3.21, 2.34, 0.25, title, 11.3, WHITE, True)
        add_text(s, x + 0.18, 3.55, 2.34, 0.38, body, 8.3, MUTED)
    for x in (3.42, 6.53, 9.64):
        add_text(s, x, 3.16, 0.26, 0.30, "→", 16, MUTED, True, PP_ALIGN_CENTER)
    add_box(s, 0.62, 4.56, 5.86, 1.28, (17, 34, 56), BLUE, True, 0.8)
    add_text(s, 0.87, 4.78, 5.33, 0.25, "LIVE PATH", 8.2, BLUE, True)
    add_text(s, 0.87, 5.11, 5.26, 0.45,
             "Wallet signs → chain emits event → API verifies the receipt → ledger marks confirmed.",
             10, WHITE, True)
    add_box(s, 6.77, 4.56, 5.91, 1.28, (45, 33, 20), (125, 88, 43), True, 0.8)
    add_text(s, 7.02, 4.78, 5.35, 0.25, "DEMO PATH", 8.2, AMBER, True)
    add_text(s, 7.02, 5.11, 5.28, 0.45,
             "Simulation can show the workflow, but never counts as live funds distributed.",
             10, WHITE, True)
    add_footer(s, slides, 8, demo_url)

    # 9 — Deployment, takeaways, links
    s = slides[8]
    bg(s, CYAN)
    add_header(s, "08 · Deployment and takeaway", "The trust chain is the product.",
               "A compact recap for a live presentation, with direct links to the running app and project materials.", CYAN)
    add_box(s, 0.62, 2.49, 7.05, 2.70, PANEL, LINE, True, 0.8)
    add_text(s, 0.93, 2.78, 6.35, 0.26, "FROM SOURCE TO RUNNING APP", 9, CYAN, True)
    deploy = [
        ("1", "GitHub", "CI builds and checks the workspaces"),
        ("2", "Docker", "API + web compiled into the image"),
        ("3", "Render", "Web service + health check"),
        ("4", "SQLite disk", "Persists runtime data across restarts"),
    ]
    for i, (num, title, body) in enumerate(deploy):
        y = 3.18 + i * 0.43
        add_dot(s, 0.95, y, 0.26, (CYAN, BLUE, PURPLE, GREEN)[i])
        add_text(s, 0.95, y + 0.04, 0.26, 0.17, num, 7.2, BG, True, PP_ALIGN_CENTER)
        add_text(s, 1.36, y + 0.01, 1.22, 0.20, title, 10.2, WHITE, True)
        add_text(s, 2.64, y + 0.01, 4.38, 0.22, body, 9.1, MUTED)
    add_box(s, 7.98, 2.49, 4.70, 2.70, (10, 35, 44), (29, 100, 105), True, 0.8)
    add_text(s, 8.28, 2.80, 4.08, 0.28, "REMEMBER", 9, GREEN, True)
    add_text(s, 8.28, 3.23, 4.06, 1.15,
             "Rules control the verdict.\nThe signature binds the decision.\nThe receipt proves the payment.",
             16, WHITE, True)
    add_text(s, 8.28, 4.57, 4.04, 0.37,
             "Demo approvals and simulated transfers are not live payouts.",
             9.2, MUTED)
    add_button(s, 0.72, 5.58, 2.04, "Open QoreSentinel ↗", CYAN, BG, 9.1, demo_url)
    add_button(s, 2.98, 5.58, 1.78, "Project README ↗", PANEL2, WHITE, 8.7, "https://github.com/Jiyansh-2006/qoresentinel#readme")
    add_button(s, 4.98, 5.58, 1.74, "Source code ↗", PANEL2, WHITE, 8.7, "https://github.com/Jiyansh-2006/qoresentinel")
    add_text(s, 0.75, 6.27, 11.8, 0.28,
             "Questions? Use the clickable chapter dots to revisit the architecture, review pipeline, or payout path.",
             9.5, MUTED, False, PP_ALIGN_CENTER)
    add_footer(s, slides, 9, demo_url)

    # Document metadata and save/export
    pres.BuiltInDocumentProperties("Title").Value = "QoreSentinel — Project Explained"
    pres.BuiltInDocumentProperties("Subject").Value = "Interactive architecture and product walkthrough"
    pres.BuiltInDocumentProperties("Author").Value = "QoreSentinel"
    pres.SaveAs(str(PPTX_PATH))
    try:
        preview_dir = OUT_DIR / "slide_previews"
        preview_dir.mkdir(exist_ok=True)
        pres.Export(str(preview_dir), "PNG", 1600, 900)
    except Exception as exc:
        print(f"Slide preview export skipped: {exc}")
    pres.Close()
    app.Quit()
    print(f"Created {PPTX_PATH}")
    print(f"Slides: {len(slides)}")


if __name__ == "__main__":
    build()
