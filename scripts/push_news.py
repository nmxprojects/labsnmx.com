#!/usr/bin/env python3
"""
NMX Labs v15: sends the instant notifications queued by the build (scripts/build_news.py).

Run by .github/workflows/publish-scheduled.yml after it has committed the rebuilt site. It reads the notifications from
the environment variable PUSH_NEWS (the build's "push_news" output), waits until every story is on the live site
(news/latest.json lists its id; at most 6 minutes), so a notification never opens a page that doesn't have the story
yet, then starts .github/workflows/send-push.yml once per notification.

Needs GH_TOKEN (the workflow's own token with "actions: write") and the gh command, which GitHub's runners include.
No third-party packages.
"""
import json, os, subprocess, sys, time, urllib.request

SITE = 'https://labsnmx.com'
WAIT_SECONDS = 360


def live_ids():
    url = f'{SITE}/news/latest.json?t={int(time.time())}'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'nmx-publisher', 'Cache-Control': 'no-cache'})
        with urllib.request.urlopen(req, timeout=20) as r:
            return {x.get('id') for x in json.load(r).get('news', [])}
    except Exception as e:
        print(f'{SITE}/news/latest.json not readable yet: {e}')
        return set()


def main():
    jobs = json.loads(os.environ.get('PUSH_NEWS') or '[]')
    if not jobs:
        print('No instant notifications to send.')
        return
    want = {i for j in jobs for i in j.get('ids', [])}
    deadline = time.time() + WAIT_SECONDS
    while True:
        missing = want - live_ids()
        if not missing:
            print('The stories are live on labsnmx.com.')
            break
        if time.time() > deadline:
            print(f'::warning::Still not on labsnmx.com after {WAIT_SECONDS // 60} minutes ({", ".join(sorted(missing))}). Sending anyway.')
            break
        time.sleep(20)
    failed = 0
    for j in jobs:
        cmd = ['gh', 'workflow', 'run', 'send-push.yml',
               '-f', f'title={j["title"]}', '-f', f'message={j["message"]}', '-f', f'url={j["url"]}',
               '-f', f'audience={j["audience"]}', '-f', f'image={j.get("image") or ""}']
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode:
            failed += 1
            print(f'::error::Couldn\'t start "Send push notification" for "{j["title"]}": {r.stderr.strip()}')
        else:
            print(f'Started "Send push notification" ({j["audience"]}): {j["title"]}')
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a', encoding='utf-8') as f:
            f.write('### Instant notifications\n\n' + ''.join(f'- {j["title"]} ({j["audience"]})\n' for j in jobs)
                    + ('\nSome didn\'t start: send them from Content Blog Creator › News story › Send now, or from labsnmx.com/dashboard/.\n' if failed else ''))
    if failed:
        sys.exit(1)


if __name__ == '__main__':
    main()
