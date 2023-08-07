import { useEffect, useRef, useState } from 'react';
import { randomId } from 'poon-router/util.js';
import { useSize } from './size.js';

const FLICK_SPEED = .25; // pixels per ms
const CUTOFF_INTERVAL = 50; // ms
const LISTENER_OPTIONS = {capture: false, passive: false};

const getVelocity = (lastV = 0, newV, elapsedTime) => {
    const w1 = Math.min(elapsedTime, CUTOFF_INTERVAL) / CUTOFF_INTERVAL;
    const w0 = 1 - w1;
    return (lastV * w0) + (newV * w1);
};

let responderEl; // The element currently capturing input

export const usePanGestures = (el, opts = {}, deps) => {
    const {width, height} = useSize(el);
    const refs = useRef({'id': randomId()}).current;

    useEffect(() => {
        if (!el.current) return;

        const logVelocity = (now) => { // Log instantaneous velocity
            const elapsed = (now - refs.last.ts);
            if (elapsed > 0) {
                const vx = (refs.x - refs.last.x) / elapsed;
                const vy = (refs.y - refs.last.y) / elapsed;
                refs.v = {'x': getVelocity(refs.v.x, vx, elapsed), 'y': getVelocity(refs.v.y, vy, elapsed)};
                refs.last = {'x': refs.x, 'y': refs.y, 'ts': now};
            }
        };

        const down = (e) => {
            responderEl = null;

            const x = e.touches ? e.touches[0].clientX : e.clientX;
            const y = e.touches ? e.touches[0].clientY : e.clientY;
            Object.assign(refs, {
                'width': width,
                'height': height,
                'current': {x, y},
                'touch': true,
                'origin': {x, y},
                'locked': false,
                'v': {x: 0, y: 0},
                's': {x: 0, y: 0},
                'd': {x: 0, y: 0},
                'flick': null,
                'last': {ts: performance.now(), x, y},
            });

            if (e.touches.length === 2) {
                const dx = (e.touches[0].clientX - e.touches[1].clientX);
                const dy = (e.touches[0].clientY - e.touches[1].clientY);
                refs.pinch = {d0: Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2))};
                return;
            }

            if (opts.onDown) opts.onDown(refs);
        };

        const shouldCapture = (e) => {
            if (opts.onCapture) return opts.onCapture(refs, e);
            return true;
        };

        const move = (e) => {
            if (responderEl && responderEl !== el.current) return;

            if (refs.pinch) {
                if (e.touches.length === 2) {
                    refs.locked = 'pinch'; // pinch mode

                    const dx = (e.touches[0].clientX - e.touches[1].clientX);
                    const dy = (e.touches[0].clientY - e.touches[1].clientY);

                    refs.pinch.d = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
                    refs.pinch.scale = (refs.pinch.d / refs.pinch.d0);
                    refs.pinch.center = {
                        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
                    };
                    if (opts.onPinch) opts.onPinch(refs);
                } else {
                    delete refs.pinch;
                }
            } else {
                refs.x = e.touches ? e.touches[0].clientX : e.clientX;
                refs.y = e.touches ? e.touches[0].clientY : e.clientY;
                logVelocity(e.timeStamp);
                refs.d = {'x': (refs.x - refs.origin.x), 'y': (refs.y - refs.origin.y)};
                refs.abs = {'x': Math.abs(refs.d.x), 'y': Math.abs(refs.d.y)};

                if (!refs.locked && (refs.abs.y > 10 || refs.abs.x > 10)) { // lock scroll direction
                    refs.locked = (refs.abs.y > refs.abs.x) ? 'v' : 'h';
                }
            }

            if (refs.locked) {
                // Reduce information
                if (refs.locked === 'h') refs.distance = refs.d.x;
                if (refs.locked === 'v') refs.distance = refs.d.y;

                refs.touch = shouldCapture(e);
                if (!refs.touch) return; // Let browser handle touch
                responderEl = el.current; // capture event

                if (opts.onMove) opts.onMove(refs, e);
            }
        };

        const up = (e) => {
            if (responderEl && responderEl !== el.current) return;
            if (!refs.touch || !refs.locked) return;
            logVelocity(e.timeStamp);
            refs.s = {'x': Math.abs(refs.v.x), 'y': Math.abs(refs.v.y)};
            refs.flick = {
                'x': refs.locked === 'h' && refs.s.x >= FLICK_SPEED && Math.sign(refs.v.x),
                'y': refs.locked === 'v' && refs.s.y >= FLICK_SPEED && Math.sign(refs.v.y),
            };
            if (opts.onUp) opts.onUp(refs);
        };

        const wheel = (e) => {
            el.current.scrollTop += e.deltaY;
            if (opts.onPan) opts.onPan({d: {x: e.deltaX, y: e.deltaY}});
        };

        el.current.addEventListener('touchstart', down, LISTENER_OPTIONS);
        el.current.addEventListener('touchmove', move, LISTENER_OPTIONS);
        el.current.addEventListener('touchend', up, LISTENER_OPTIONS);
        el.current.addEventListener('wheel', wheel, LISTENER_OPTIONS);
        if (opts.onDoubleTap) el.current.addEventListener('dblclick', opts.onDoubleTap, LISTENER_OPTIONS);

        return () => {
            if (!el.current) return;
            el.current.removeEventListener('touchstart', down);
            el.current.removeEventListener('touchmove', move);
            el.current.removeEventListener('touchend', up);
            el.current.removeEventListener('wheel', wheel);
            if (opts.onDoubleTap) el.current.removeEventListener('dblclick', opts.onDoubleTap);
        };
    }, [el, height, width, deps]);

    return {height, width};
};