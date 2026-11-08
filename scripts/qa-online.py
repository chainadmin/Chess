#!/usr/bin/env python3
"""Two-browser local online smoke test. Export with EXPO_PUBLIC_ONLINE_URL first.
Requires Python Playwright and Chromium. Starts and stops only its own servers.
Usage: python scripts/qa-online.py --output /tmp/shiftchess-qa
"""
import argparse
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import time
import urllib.request
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=Path('/tmp/shiftchess-online-qa'))
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
results, errors, sessions, states = [], [], {}, {}

def passed(name):
    results.append(name)
    print('PASS:', name, flush=True)

def available(port):
    with socket.socket() as s:
        s.bind(('127.0.0.1', port))

def ready(url, process):
    for _ in range(100):
        if process.poll() is not None:
            raise RuntimeError(f'Server exited: {url}')
        try:
            urllib.request.urlopen(url, timeout=0.5).close()
            return
        except OSError:
            time.sleep(0.1)
    raise RuntimeError(f'Server not ready: {url}')

def click(page, name):
    page.get_by_role('button', name=name, exact=True).click()

def shot(page, name):
    page.screenshot(path=str(args.output / name), full_page=True)

def observe(response, label):
    if response.request.method != 'POST':
        return
    if response.url.endswith('/session') and response.status == 201:
        # Never persist credentials in QA evidence.
        sessions[label] = response.json()['player']['id']
    if response.url.endswith('/command'):
        data = response.json()
        if response.status != 200:
            errors.append(f'{label}: command HTTP {response.status}: {data.get("error", {}).get("code")}')
        elif data.get('status') == 'matched':
            states[label] = data['match']

processes, logs = [], []
try:
    available(8787)
    available(8081)
    for command, name in [
        (['npm', 'run', 'online:server'], 'server.log'),
        (['python', '-m', 'http.server', '8081', '--bind', '127.0.0.1', '--directory', 'dist'], 'web.log'),
    ]:
        log = open(args.output / name, 'w')
        logs.append(log)
        processes.append(subprocess.Popen(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, start_new_session=True))
    ready('http://127.0.0.1:8787/health', processes[0])
    ready('http://127.0.0.1:8081/', processes[1])
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        contexts = [
            browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, device_scale_factor=1),
            browser.new_context(viewport={'width': 1100, 'height': 950}),
        ]
        pages = [context.new_page() for context in contexts]
        for label, page in zip(['mobile', 'desktop'], pages):
            page.set_default_timeout(15_000)
            page.on('pageerror', lambda err, label=label: errors.append(f'{label}: {err}'))
            page.on('response', lambda response, label=label: observe(response, label))
            page.goto('http://127.0.0.1:8081/')
            click(page, 'Continue as Guest')
            click(page, 'Online 3+2 · Always free')
            expect(page.get_by_role('button', name='Find a free 3+2 game', exact=True)).to_be_visible()
        mobile, desktop = pages
        passed('Two isolated browser contexts enter configured online lobby')
        click(mobile, 'Find a free 3+2 game')
        expect(mobile.get_by_text('Looking for another player…', exact=True)).to_be_visible()
        mobile.wait_for_timeout(5_000)
        assert mobile.get_by_test_id('chess-board').count() == 0
        shot(mobile, '01-mobile-waiting-alone.png')
        passed('Alone in queue for five seconds: no fake opponent or board')
        click(mobile, 'Cancel search')
        expect(mobile.get_by_role('button', name='Find a free 3+2 game', exact=True)).to_be_visible()
        click(desktop, 'Find a free 3+2 game')
        desktop.wait_for_timeout(2_000)
        expect(desktop.get_by_text('Looking for another player…', exact=True)).to_be_visible()
        assert desktop.get_by_test_id('chess-board').count() == 0
        passed('Cancelled mobile search does not pair with desktop joining later')
        click(mobile, 'Find a free 3+2 game')
        for page in pages:
            expect(page.get_by_test_id('chess-board')).to_be_visible()
        assert sessions['mobile'] != sessions['desktop']
        assert states['mobile']['matchId'] == states['desktop']['matchId']
        assert {states['mobile']['playerColor'], states['desktop']['playerColor']} == {'white', 'black'}
        white = mobile if states['mobile']['playerColor'] == 'white' else desktop
        black = desktop if white == mobile else mobile
        expect(white.get_by_text('Your turn', exact=True)).to_be_visible()
        expect(black.get_by_text('Opponent’s turn', exact=True)).to_be_visible()
        passed('Distinct authenticated guests share one actual match with opposite colors')
        for page, first_square, own_pawn in [(white, 'a8', 'a2'), (black, 'j1', 'j7')]:
            first = page.get_by_test_id('chess-board').locator('[data-testid^="square-"]').first
            assert first.get_attribute('data-testid') == f'square-{first_square}'
            top = first.bounding_box()
            pawn = page.get_by_test_id(f'square-{own_pawn}').bounding_box()
            assert pawn['y'] > top['y']
        passed('Black board is rotated 180 degrees with own pieces at bottom')
        board = mobile.get_by_test_id('chess-board').bounding_box()
        assert board['x'] >= 0 and board['x'] + board['width'] <= 391
        assert mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        shot(mobile, '02-mobile-matched.png')
        shot(desktop, '03-desktop-matched.png')
        passed('390px mobile board fits viewport without horizontal overflow')
        white.get_by_test_id('square-e2').click()
        expect(white.get_by_test_id('square-e4')).to_have_attribute('aria-label', 'e4, empty, legal destination')
        white.get_by_test_id('square-e4').click()
        for page in pages:
            expect(page.get_by_test_id('square-e4')).to_have_attribute('aria-label', 'e4, white Pawn')
            expect(page.get_by_test_id('square-e2')).to_have_attribute('aria-label', 'e2, empty')
        expect(black.get_by_text('Your turn', exact=True)).to_be_visible()
        black.get_by_test_id('square-e7').click()
        black.get_by_test_id('square-e5').click()
        for page in pages:
            expect(page.get_by_test_id('square-e5')).to_have_attribute('aria-label', 'e5, black Pawn')
            expect(page.get_by_test_id('square-e7')).to_have_attribute('aria-label', 'e7, empty')
        expect(white.get_by_text('Your turn', exact=True)).to_be_visible()
        assert all(state['revision'] == 2 and len(state['game']['history']) == 2 for state in states.values())
        shot(mobile, '04-mobile-after-moves.png')
        passed('White e2-e4 and Black e7-e5 synchronize both boards and turns')
        match_id = states['mobile']['matchId']
        click(mobile, 'Back Home')
        click(mobile, 'Online 3+2 · Always free')
        expect(mobile.get_by_test_id('chess-board')).to_be_visible()
        expect(mobile.get_by_test_id('square-e5')).to_have_attribute('aria-label', 'e5, black Pawn')
        assert states['mobile']['matchId'] == match_id
        passed('Back Home then Online resumes the same live match and position')
        click(mobile, 'Resign')
        expect(mobile.get_by_text('Resign this game?', exact=True)).to_be_visible()
        shot(mobile, '05-mobile-resignation-dialog.png')
        click(mobile, 'Keep playing')
        expect(mobile.get_by_text('Resign this game?', exact=True)).not_to_be_visible()
        assert states['mobile']['game']['status'] == 'active'
        passed('Keep playing dismisses resignation without changing result')
        click(mobile, 'Resign')
        click(mobile, 'Confirm resignation')
        winner = 'Black' if mobile == white else 'White'
        for page in pages:
            expect(page.get_by_text(f'{winner} wins · resigned', exact=True)).to_be_visible()
            expect(page.get_by_role('button', name='Play another free 3+2', exact=True)).to_be_visible()
        assert all(state['game']['status'] == 'resigned' for state in states.values())
        shot(mobile, '06-mobile-result.png')
        shot(desktop, '07-desktop-result.png')
        passed('Confirmed resignation shows matching server result on both clients')
        assert not errors, errors
        passed('No JavaScript page errors or failed command responses')
        browser.close()
except Exception as failure:
    errors.append(f'{type(failure).__name__}: {failure}')
    if 'pages' in locals():
        for i, page in enumerate(pages):
            try:
                shot(page, f'failure-{i}.png')
            except Exception:
                pass
    raise
finally:
    for process in processes:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
    for log in logs:
        log.close()
    (args.output / 'report.json').write_text(json.dumps({'passed': results, 'errors': errors}, indent=2))
