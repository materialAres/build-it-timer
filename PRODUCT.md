# Product

## Platform

web

## Users

General knowledge workers and students who install the extension from the Chrome Web Store or Firefox Add-ons. They open the browser popup to start a focus session, then go back to their work in other tabs. They check the popup now and then to see how their city is growing and what their score is.

## Product Purpose

Build-it! Timer Focus is a browser extension that helps people stay focused. It pairs a countdown focus timer with a 3D neon city that grows while they work. It blocks distracting sites during a session, and giving in to a distraction costs them part of the city. Success means people finish their sessions with as much of the city built as possible, and they come back for the next session.

## Positioning

Focus time becomes something you can see. Every few seconds of undistracted work (the pace follows the session length) pays for a bit more of a floor, and floors stack into a city seen from above at an angle. A distraction (the malus) takes part of that back, and the top floor shows the damage. Each session gets its own new city from a seed, with its own streets, buildings and colors, and the result is kept as a score, a population and a city image. Where WebGL is unavailable the city falls back to ASCII text.

## Operating Context

- Lives in the browser toolbar popup, which has four tabs: Timer, City, Blocklist and Score. The popup is small and opened for short glances.
- Sites are blocked only while a session is `running`. Nothing is blocked outside a session.
- The blocklist can be edited only while no session is in progress, either before Start or after Reset.
- A visit to a blocked site shows a content-script overlay in Shadow DOM, layered over that page.
- The interface language follows the browser: Italian if the browser is set to Italian, English otherwise. There is no manual language selector.

## Capabilities and Constraints

- **Timer**: start, pause and reset a countdown. `browser.alarms` persists the countdown across service-worker restarts, and the UI estimates the time between alarm ticks.
- **Blocklist**: individual domains, data-defined presets (such as Social and Video) and custom tags. Domains are normalized with `tldts` and enforced through `declarativeNetRequest`.
- **Score**: `bad` below 30% of the city built, `good` from 30%, `great` from 70%, `excellent` only at 100%. The score updates live and drops back when a distraction removes characters.
- **Population**: each character earns 5, 10 or 20 depending on the completion band. A finished city adds a bonus of 7% of the population.
- **History**: the last 5 completed sessions, and the city can be exported as PNG or JPEG.
- **Technical**: Manifest V3 on both Chrome and Firefox. Built with React 19, WXT, Zustand and framer-motion. The UI only presents state; the logic lives in the background script and in `lib/`.
- **Undecided**: whether the Good/Bad score thresholds will be user-configurable.

## Brand Commitments

- Working name "Build-it! Timer Focus" (the docs also say "BuildIt"). The user has not said this name is final.
- Voice: neutral and minimal. Copy is factual and quiet and stays out of the way. The city communicates progress and loss, so text does not scold, cheer or coach, including on the malus overlay and the score.
- The city is the core of the product's identity: a glowing phosphor skyline on a black ground.

## Evidence on Hand

- Real product copy in `locales/en.yml` and `locales/it.yml`.
- Feature description in `README.md`.
- There are no testimonials, user counts, store ratings or press. Do not make any up.

## Product Principles

1. The city is the feedback. Show progress and loss through the city before adding text or alerts.
2. Quiet by default. The popup is a quick glance, and the extension should never compete with the work it protects.
3. Honest consequences. Distraction has a real, visible cost, stated plainly and without moralizing.
4. Blocking only during a session. The extension never limits the browser outside a session the user started.
5. Built for every language. Every user-facing string goes through i18n, so adding a language is trivial.
