import React, { useMemo, forwardRef, useState, useRef, useEffect, Fragment, useImperativeHandle, Children, memo, createElement } from 'react';
import { createBus, useBus, randomId } from 'poon-router/util.js';
import { navigation } from 'poon-router';

const c = (...rest) => rest.filter(Boolean).join(' ');
const toPercent = val => `${val * 100}%`;
const clamp = (num, min, max) => Math.min(Math.max(num, min), max);
const clone = obj => Object.assign({}, obj);
const sameObject = (a, b) => Object.keys(a).every(key => a[key] === b[key]);
const bounce = (num, min, max) => {
  if (num > max) return max + (max + num) / 50;
  if (num < min) return min - (min - num) / 50;
  return num;
};
const easeOutCubic = t => --t * t * t + 1;
const createClamp = (min, max) => {
  return val => clamp(val, min, max);
};
const lerp = (val, v0, v1) => {
  return (1 - val) * v0 + val * v1;
};

class AnimatedValue {
  constructor(initialValue, id) {
    this.id = id;
    this.listeners = [];
    this.value = initialValue;
    this.oldValue = initialValue;
  }
  setValue = (value, end = true) => {
    if (isNaN(value)) return console.warn('Cant animate NaN');
    if (end) {
      // Stop animations and set the checkpoint
      delete this.id;
      this.oldValue = value;
    }
    this.value = value;
    this.listeners.forEach(fn => fn(value));
  };
  spring = (finalValue, duration = AnimatedValue.defaultAnimationDuration) => new Promise(resolve => {
    if (finalValue === this.value) return resolve(); // cancel unnecessary animation

    const t0 = this.id = performance.now(); // a unique id for this animation lifecycle
    const oldValue = this.value;
    const animate = t => {
      if (t0 !== this.id) return;
      const elapsed = Math.max(0, t - t0); // time hack
      if (elapsed >= duration) {
        this.setValue(finalValue, true);
        resolve();
      } else {
        const d = (finalValue - oldValue) * easeOutCubic(elapsed / duration);
        this.setValue(oldValue + d, false);
        requestAnimationFrame(animate);
      }
    };
    animate(t0);
  });
  on = fn => {
    this.listeners.push(fn);
    return () => this.listeners = this.listeners.filter(i => i !== fn);
  };
  end = () => {
    delete this.id;
  };
}
AnimatedValue.defaultAnimationDuration = 300;
const useAnimatedValue = initialValue => useMemo(() => {
  return new AnimatedValue(initialValue);
}, []);

const Touchable = /*#__PURE__*/forwardRef(({
  href,
  onClick,
  className,
  active,
  target,
  children,
  style,
  disableMenu
}, ref) => {
  const [touched, setTouched] = useState(false);
  const moved = useRef(false);
  const clickButton = e => {
    if (moved.current) return e.preventDefault();
    if (onClick) {
      if (!href) {
        e.preventDefault();
        // e.stopPropagation();
      }

      onClick(e);
    }
  };
  const touch = e => {
    if (e.button && e.button !== 0) return; // If mouse, only process left clicks
    e.stopPropagation();
    moved.current = false;
    setTouched(true);
  };
  const leave = () => {
    setTouched(false);
  };
  return /*#__PURE__*/React.createElement(href ? 'a' : 'button', {
    'href': href,
    'onTouchStart': touch,
    'onTouchMove': leave,
    'onTouchEnd': leave,
    'onMouseDown': touch,
    'onMouseUp': leave,
    'onMouseLeave': leave,
    'onClick': clickButton,
    'className': c('touchable', className, touched && 'touched', disableMenu && 'disable-menu', active && 'active'),
    'target': target,
    'draggable': false,
    'onContextMenu': disableMenu ? e => {
      e.preventDefault();
      return false;
    } : undefined,
    'style': style,
    'type': 'button',
    'ref': ref
  }, children);
});

const iOS = /iPad|iPhone|iPod/.test(navigator.platform);
const iconMap = {
  'os:back': iOS ? 'arrow_back_ios' : 'arrow_back',
  'os:share': iOS ? 'ios_share' : 'share',
  'os:close': iOS ? 'keyboard_arrow_down' : 'close'
};
const Icon = ({
  icon,
  className,
  color,
  title,
  size,
  onClick
}) => /*#__PURE__*/React.createElement("i", {
  className: c('material-icons', className),
  style: {
    color,
    fontSize: size
  },
  title: title,
  onClick: onClick,
  children: iconMap[icon] || icon
});

const TouchableRow = ({
  title,
  meta,
  leftIcon,
  href,
  onClick,
  onPressMore,
  target,
  children,
  caret,
  disabled,
  RightComponent,
  className,
  active
}) => /*#__PURE__*/React.createElement(Touchable, {
  className: c('touchable-highlight touchable-row', disabled && 'disabled', className),
  onClick: onClick,
  href: href,
  target: target,
  active: active
}, /*#__PURE__*/React.createElement("div", {
  className: "touchable-row-left"
}, typeof leftIcon === 'string' ? /*#__PURE__*/React.createElement("div", {
  className: "touchable-row-icon"
}, /*#__PURE__*/React.createElement(Icon, {
  icon: leftIcon
})) : null, typeof leftIcon === 'object' ? /*#__PURE__*/React.createElement("div", {
  className: "touchable-row-icon"
}, leftIcon) : null, /*#__PURE__*/React.createElement("div", {
  className: "touchable-row-content"
}, title ? /*#__PURE__*/React.createElement("div", {
  className: "touchable-row-title",
  children: title
}) : null, meta ? /*#__PURE__*/React.createElement("div", {
  className: "meta",
  children: meta
}) : null, children)), RightComponent, onPressMore ? /*#__PURE__*/React.createElement(Touchable, {
  onClick: onPressMore
}, /*#__PURE__*/React.createElement(Icon, {
  icon: "more_vert"
})) : null, caret ? /*#__PURE__*/React.createElement(Icon, {
  icon: "chevron_right"
}) : null);

const useSize = el => {
  const [size, setSize] = useState({
    'width': el.current?.clientWidth,
    'height': el.current?.clientHeight
  });
  useEffect(() => {
    // Observe size of element
    if (!el.current) return;
    const ro = new ResizeObserver(entries => {
      const e = entries[0].borderBoxSize[0];
      setSize({
        'height': e.blockSize,
        'width': e.inlineSize
      });
    });
    ro.observe(el.current);
    return ro.disconnect.bind(ro);
  }, []);
  return size;
};

const FLICK_SPEED = .25; // Pixels per ms
const CUTOFF_INTERVAL = 50; // Milliseconds
const LISTENER_OPTIONS = {
  capture: false,
  passive: false
};
const getVelocity = (lastV = 0, newV, elapsedTime) => {
  const w1 = Math.min(elapsedTime, CUTOFF_INTERVAL) / CUTOFF_INTERVAL;
  const w0 = 1 - w1;
  return lastV * w0 + newV * w1;
};
let responderEl; // The element currently capturing input

const getXY = (e, i = 0) => {
  return {
    'x': e.touches ? e.touches[i].clientX : e.clientX,
    'y': e.touches ? e.touches[i].clientY : e.clientY
  };
};
const useGesture = (el, opts = {}, deps) => {
  const {
    width,
    height
  } = useSize(el);
  const refs = useRef({}).current; // Internal key values

  useEffect(() => {
    if (!el.current) return;
    const logVelocity = now => {
      // Log instantaneous velocity
      const elapsed = now - refs.last.ts;
      if (elapsed > 0) {
        const vx = (refs.x - refs.last.x) / elapsed;
        const vy = (refs.y - refs.last.y) / elapsed;
        refs.v = {
          'x': getVelocity(refs.v.x, vx, elapsed),
          'y': getVelocity(refs.v.y, vy, elapsed)
        };
        refs.last = {
          'x': refs.x,
          'y': refs.y,
          'ts': now
        };
      }
    };
    const down = e => {
      if (e.pageX < 10) e.preventDefault();
      if (e.touches.length === 2) {
        // The first touch already happened
        const t0 = getXY(e, 0),
          t1 = getXY(e, 1); // Get two touches
        const dx = t0.x - t1.x,
          dy = t0.y - t1.y; // Distance between touches
        refs.pinch = {
          d0: Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2))
        };
        return;
      }

      // Clear previous values
      responderEl = null;
      for (let key in refs) delete refs[key];
      const {
        x,
        y
      } = getXY(e);
      Object.assign(refs, {
        'x': x,
        'y': y,
        'size': {
          'x': width,
          'y': height
        },
        // Size of the element
        'width': width,
        // Todo: remove
        'height': height,
        // Todo: remove
        'locked': false,
        // Direction
        'touch': false,
        // Whether we've captured the touch
        'origin': {
          x,
          y
        },
        // Initial touch position
        'd': {
          x: 0,
          y: 0
        },
        // Distance
        'v': {
          x: 0,
          y: 0
        },
        // Velocity
        's': {
          x: 0,
          y: 0
        },
        // Speed
        'flick': null,
        'last': {
          'ts': e.timeStamp,
          x,
          y
        }
      });
      if (opts.onDown) opts.onDown(refs); // Consider if this needs to stay
    };

    const move = e => {
      if (responderEl && responderEl !== el.current) return;
      if (refs.pinch) {
        // Pinch mode
        if (e.touches.length === 2) {
          refs.locked = 'pinch'; // pinch mode

          const t0 = getXY(e, 0),
            t1 = getXY(e, 1);
          const dx = t0.x - t1.x,
            dy = t0.y - t1.y;
          refs.pinch.d = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
          if (opts.onPinch) opts.onPinch({
            'center': {
              'x': (t0.x + t1.x) / 2,
              'y': (t0.y + t1.y) / 2
            },
            'scale': refs.pinch.d / refs.pinch.d0
          });
        }
      } else {
        // Single touch mode
        const {
          x,
          y
        } = getXY(e);
        refs.x = x;
        refs.y = y;
        logVelocity(e.timeStamp);
        refs.d = {
          'x': refs.x - refs.origin.x,
          'y': refs.y - refs.origin.y
        };
        if (!refs.locked) {
          // Consider locking scroll direction
          const absX = Math.abs(refs.d.x),
            absY = Math.abs(refs.d.y); // Get absolute distance
          if (absY > 10 || absX > 10) refs.locked = absY > absX ? 'y' : 'x';
        }
      }
      if (refs.locked) {
        // Reduce information
        if (refs.locked === 'x') {
          refs.distance = refs.d.x;
        } else if (refs.locked === 'y') {
          refs.distance = refs.d.y;
        }
        if (!refs.touch) {
          // Check if we should start capturing
          refs.touch = opts.onCapture({
            'direction': refs.locked,
            'distance': refs.d[refs.locked],
            'size': refs.size[refs.locked],
            'pinch': refs.pinch
          });

          // if (refs.touch) console.log('Captured!', el.current);
        }

        if (refs.touch) {
          e.stopPropagation();
          responderEl = el.current; // capture event

          if (opts.onMove) opts.onMove({
            'd': refs.d,
            'direction': refs.locked,
            'distance': refs.d[refs.locked],
            'velocity': refs.v[refs.locked],
            'size': refs.size[refs.locked]
          }, e);
        }
      }
    };
    const up = e => {
      if (e.touches.length > 0) return; // Still touching, not actually up
      if (responderEl && responderEl !== el.current) return;
      if (!refs.touch) return;
      logVelocity(e.timeStamp);
      const velocity = refs.v[refs.locked];
      const speed = Math.abs(velocity);
      const distance = refs.d[refs.locked];
      const size = refs.size[refs.locked];
      if (refs.locked) {
        // Detect flick by speed or distance
        const flick = speed >= FLICK_SPEED && Math.sign(velocity) || Math.abs(distance) > size / 2 && Math.sign(distance);
        if (opts.onUp) opts.onUp({
          'flick': flick * -1,
          // Invert direction for use with pagers
          'flickMs': Math.min((size - Math.abs(distance)) / speed, 300),
          'direction': refs.locked,
          'velocity': velocity,
          'size': size
        });
      }
    };
    const wheel = e => {
      el.current.scrollTop += e.deltaY;
      if (opts.onPan) opts.onPan({
        'x': {
          'distance': e.deltaX,
          'size': width
        },
        'y': {
          'distance': e.deltaY,
          'size': height
        }
      });
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
  return {
    height,
    width
  };
};

const BottomSheet = /*#__PURE__*/forwardRef(({
  className,
  visible,
  pan,
  children,
  onClose,
  onPress,
  showShade,
  showHandle
}, ref) => {
  const shadeEl = useRef();
  const sheetEl = useRef();
  const {
    height
  } = useGesture(sheetEl, {
    onCapture: e => {
      return e.direction === 'y';
    },
    onMove: e => {
      pan.setValue(e.size - Math.max(e.distance / 100, e.distance));
    },
    onUp: e => {
      if (e.flick === -1) return pan.spring(0, e.flickMs).then(onClose);
      pan.spring(e.size);
    }
  });
  const close = () => pan.spring(0).then(onClose);
  useEffect(() => {
    if (!height) return;
    return pan.on(value => {
      sheetEl.current.style.transform = `translateY(-${value}px)`;
      if (shadeEl.current) shadeEl.current.style.opacity = value / height;
    });
  }, [height]);
  useEffect(() => {
    if (!height) return;
    if (visible) {
      // show
      pan.spring(height);
    } else {
      // hide
      pan.spring(0).then(onClose);
    }
  }, [visible, height, onClose]);
  return /*#__PURE__*/React.createElement("div", {
    className: "layer"
  }, visible && showShade ? /*#__PURE__*/React.createElement("div", {
    className: "shade shade-bottom-sheet",
    ref: shadeEl,
    onClick: close
  }) : null, /*#__PURE__*/React.createElement("div", {
    ref: sheetEl,
    className: c('sheet', className),
    onClick: onPress
  }, showHandle ? /*#__PURE__*/React.createElement("div", {
    className: "handle"
  }) : null, children));
});

const bus = createBus(null);
const pan = new AnimatedValue(0);
const ActionSheet = () => {
  const sheet = useBus(bus);
  const renderOption = (option, i) => {
    const clickOption = e => {
      if (option.onClick) option.onClick();
      if (sheet.callback) sheet.callback(option.value);
      pan.spring(0).then(() => bus.update(0));
    };
    return /*#__PURE__*/React.createElement(TouchableRow, {
      key: i,
      title: option.name,
      leftIcon: option.icon,
      onClick: clickOption,
      disabled: option.disabled,
      target: option.target,
      href: option.href
    });
  };
  if (!sheet) return null;
  return /*#__PURE__*/React.createElement(BottomSheet, {
    pan: pan,
    visible: !!sheet,
    onClose: () => bus.update(null),
    showShade: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "action-sheet-title"
  }, sheet && sheet.title), /*#__PURE__*/React.createElement("hr", null), sheet.options.map(renderOption));
};
const showActionSheet = (title, options, callback) => bus.update({
  title,
  options,
  callback
});

const array = new Array(12).fill(0);
const ActivityIndicator = ({
  size = 16,
  color = '#fff'
}) => {
  const renderSegment = (x, i) => {
    const style = {
      'width': 1.7,
      'borderRadius': 1,
      'left': size / 2 - 1,
      'height': size / 4,
      'animationDelay': (-1.1 + .1 * i).toFixed(1) + 's',
      'transform': `rotate(${30 * i}deg)`,
      'backgroundColor': color,
      'transformOrigin': `50% ${size / 2}px`
    };
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: style
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "activity-indicator",
    style: {
      width: size,
      height: size
    },
    children: array.map(renderSegment)
  });
};

const PullIndicator = /*#__PURE__*/forwardRef(({
  pull
}, ref) => {
  return /*#__PURE__*/React.createElement("div", {
    className: "pull-indicator center",
    ref: ref
  }, /*#__PURE__*/React.createElement(Icon, {
    icon: "refresh",
    color: "#000"
  }));
});

const ScrollView = /*#__PURE__*/forwardRef(({
  children,
  className,
  onRefresh,
  horizontal
}, ref) => {
  const el = ref || useRef();
  const spinnerEl = useRef();
  const refs = useRef({}).current;
  const pull = useAnimatedValue(0);
  const scroll = useAnimatedValue(0);
  useGesture(el, {
    onDown() {
      refs.canScrollVertical = el.current.scrollHeight > el.current.clientHeight;
      refs.canScrollHorizontal = el.current.scrollWidth > el.current.clientWidth;
      refs.initScrollTop = el.current.scrollTop;
      refs.initScrollLeft = el.current.scrollLeft;
      scroll.end();
    },
    onCapture(e) {
      if (e.direction === 'x') return refs.canScrollHorizontal;
      if (e.direction === 'y') {
        if (onRefresh && el.current.scrollTop === 0 && e.distance > 0) return true; // pull to refresh
        if (!refs.canScrollVertical) return false; // not a scroller
        if (refs.initScrollTop === 0 && e.distance < 0) return true; // beginning to scroll down
        return refs.initScrollTop > 0;
      }
    },
    onMove(e) {
      if (e.direction === 'y') {
        if (onRefresh && refs.initScrollTop === 0) {
          // Reveal pull to refresh indicator
          pull.setValue(Math.min(70, e.distance));
        } else {
          scroll.setValue(refs.initScrollTop - e.distance);
        }
      } else if (e.direction === 'x') {
        scroll.setValue(refs.initScrollLeft - e.distance);
      }
    },
    onUp(e) {
      if (e.direction === 'y') {
        if (onRefresh && refs.initScrollTop === 0) {
          // Pull to refresh
          if (e.distance > 70) {
            pull.spring(0).then(onRefresh);
          } else {
            pull.spring(0);
          }
        } else if (e.velocity) {
          // Coast scrolling
          scroll.spring(scroll.value - e.velocity * 2000, 2000);
        }
      } else if (e.direction === 'h') {
        if (e.velocity) scroll.spring(scroll.value - e.velocity * 2000, 2000); // Coast scrolling
      }
    }
  });

  useEffect(() => {
    return scroll.on(val => {
      if (horizontal) {
        el.current.scrollLeft = val;
      } else {
        el.current.scrollTop = val;
      }
    });
  }, []);
  useEffect(() => {
    if (!onRefresh) return;
    return pull.on(val => {
      const percent = val / 70;
      spinnerEl.current.style.transform = `translateY(${val}px) rotate(${percent * 360}deg)`;
      spinnerEl.current.style.opacity = percent;
    });
  }, []);
  const handleScroll = () => {
    navigator.virtualKeyboard?.hide();
    document.activeElement.blur();
  };
  return /*#__PURE__*/React.createElement(Fragment, null, onRefresh ? /*#__PURE__*/React.createElement("div", {
    className: "list-pull"
  }, /*#__PURE__*/React.createElement(PullIndicator, {
    pull: pull,
    ref: spinnerEl
  })) : null, /*#__PURE__*/React.createElement("div", {
    className: c('scroller', className, horizontal ? 'horizontal' : 'vertical'),
    ref: el,
    onScroll: handleScroll,
    children: children
  }));
});

const Button = ({
  className,
  title,
  onClick,
  onDown,
  icon,
  href,
  tabIndex,
  color,
  disabled,
  download,
  iconImageUrl,
  loading,
  submit,
  fullWidth,
  target
}) => {
  const cn = c('btn', className, disabled && 'disabled', fullWidth && 'full-width', color && `btn-${color}`);
  const renderInner = () => {
    if (loading) return /*#__PURE__*/React.createElement(ActivityIndicator, null);
    return /*#__PURE__*/React.createElement(Fragment, null, iconImageUrl ? /*#__PURE__*/React.createElement("img", {
      src: iconImageUrl,
      alt: title
    }) : null, icon ? /*#__PURE__*/React.createElement(Icon, {
      icon: icon
    }) : null, title ? /*#__PURE__*/React.createElement("span", null, title) : null);
  };
  return /*#__PURE__*/React.createElement(Touchable, {
    type: submit ? 'submit' : 'button',
    className: cn,
    onClick: e => {
      if (download) e.stopPropagation();
      if (onClick) onClick(e);
    },
    href: href,
    onTouchStart: onDown,
    tabIndex: tabIndex,
    children: renderInner(),
    target: target
  });
};

const alertsStore = createBus([]);
const dismissAlert = (alert, val) => {
  // Hide alert
  alertsStore.update(alertsStore.state.map(a => {
    if (a === alert) a.visible = false;
    return a;
  }));

  // Remove alert when animation completes
  setTimeout(() => {
    alert.callback(val);
    alertsStore.update(alertsStore.state.filter(a => a !== alert));
  }, 300);
};
const SingleAlert = ({
  alert,
  isLast
}) => {
  const renderButton = (option, i) => {
    const pressButton = () => {
      if (option.onPress) option.onPress();
      dismissAlert(alert, option._id || option.value);
    };
    return /*#__PURE__*/React.createElement(Touchable, {
      key: i,
      className: c('alert-button', option.destructive && 'destructive'),
      onClick: pressButton,
      children: option.name,
      disableMenu: true
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    className: c('alert-container', isLast && alert.visible && alert.className)
  }, /*#__PURE__*/React.createElement("div", {
    className: c('alert', isLast && alert.visible && 'visible'),
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "alert-top"
  }, alert.title ? /*#__PURE__*/React.createElement("div", {
    className: "alert-title"
  }, alert.title) : null, alert.message ? /*#__PURE__*/React.createElement("div", {
    className: "alert-message"
  }, alert.message) : null), alert.options ? /*#__PURE__*/React.createElement(ScrollView, {
    className: c('alert-buttons', alert.options.length <= 2 && 'alert-buttons-horizontal'),
    children: alert.options.map(renderButton)
  }) : /*#__PURE__*/React.createElement("div", {
    className: "alert-bottom"
  }, /*#__PURE__*/React.createElement(Button, {
    color: "white",
    fullWidth: true,
    title: "Close",
    onClick: () => dismissAlert(alert)
  }))));
};
const Alert = () => {
  const alerts = useBus(alertsStore);
  const last = alerts.filter(alert => alert.visible).pop();
  if (alerts.length === 0) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: c('layer alert-backdrop', alerts.some(a => a.visible) && 'visible'),
    onClick: () => dismissAlert(last),
    children: alerts.map(alert => /*#__PURE__*/React.createElement(SingleAlert, {
      key: alert.key,
      alert: alert,
      isLast: last === alert
    }))
  });
};
const showAlert = (alert, options) => new Promise(resolve => {
  alertsStore.update([...alertsStore.state, {
    'key': randomId(),
    'callback': resolve,
    'visible': true,
    'options': options,
    ...alert
  }]);
});

const Avatar = ({
  imageId,
  className,
  variant,
  getUrl
}) => {
  if (!imageId) return /*#__PURE__*/React.createElement("div", {
    draggable: false,
    className: c('avatar', className)
  });
  return /*#__PURE__*/React.createElement("img", {
    draggable: false,
    className: c('avatar', className),
    src: getUrl(imageId, variant)
  });
};
Avatar.defaultProps = {
  variant: 'normal',
  getUrl: () => null
};

const BreadCrumbs = ({
  path,
  onClickPath
}) => {
  const slugs = path.split('/').filter(Boolean);
  const renderSlug = (slug, i) => /*#__PURE__*/React.createElement(Fragment, {
    key: slug + '_' + i
  }, /*#__PURE__*/React.createElement(Touchable, {
    onClick: () => onClickPath(),
    children: slug
  }), i < slugs.length - 1 ? /*#__PURE__*/React.createElement("span", null, " / ") : null);
  if (slugs.length === 0) return null;
  return /*#__PURE__*/React.createElement(ScrollView, {
    horizontal: true,
    className: "breadcrumbs"
  }, /*#__PURE__*/React.createElement(Icon, {
    icon: "home",
    onClick: () => onClickPath('/')
  }), /*#__PURE__*/React.createElement("span", null, " / "), slugs.map(renderSlug));
};

const closeImage = {
  'card': 'os:back',
  'modal': 'os:close'
};
const ScreenHeader = ({
  title,
  subtitle,
  presentation = 'card',
  onClose,
  headerRight,
  SearchComponent
}) => {
  const pressBack = e => {
    e.stopPropagation();
    e.preventDefault();
    onClose();
  };
  const closeIcon = closeImage[presentation];
  return /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "header-spacer"
  }, closeIcon && /*#__PURE__*/React.createElement(Touchable, {
    className: "header-close",
    onClick: pressBack,
    children: /*#__PURE__*/React.createElement(Icon, {
      icon: closeIcon
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "header-middle"
  }, /*#__PURE__*/React.createElement("div", {
    className: "header-title"
  }, title), subtitle ? /*#__PURE__*/React.createElement("div", {
    className: "header-subtitle"
  }, subtitle) : null), /*#__PURE__*/React.createElement("div", {
    className: "header-spacer"
  }, headerRight)), SearchComponent);
};

const Placeholder = ({
  className,
  icon,
  title,
  message,
  children
}) => /*#__PURE__*/React.createElement("div", {
  className: c('placeholder', className)
}, icon ? /*#__PURE__*/React.createElement(Icon, {
  icon: icon
}) : null, title ? /*#__PURE__*/React.createElement("div", {
  className: "title"
}, title) : null, message ? /*#__PURE__*/React.createElement("div", {
  className: "placeholder-message"
}, message) : null, children);

const Shade = /*#__PURE__*/forwardRef(({}, ref) => {
  const el = useRef();
  useImperativeHandle(ref, () => ({
    progress: (value, width) => {
      if (el.current) el.current.style.opacity = 1 - value / width;
    }
  }));
  return /*#__PURE__*/React.createElement("div", {
    className: "shade shade-card",
    ref: el
  });
});

const Card = /*#__PURE__*/forwardRef(({
  title,
  subtitle,
  children,
  footer,
  headerRight,
  SearchComponent,
  disableGestures,
  onDrop,
  isVisible = true,
  animateIn = true,
  ShadeComponent = Shade,
  HeaderComponent,
  className
}, el) => {
  el = el || useRef();
  const allowBack = useRef(history.length > 1).current;
  const [dropping, setDropping] = useState(false);
  const shadeEl = useRef();
  const pan = useAnimatedValue(animateIn ? document.body.clientWidth : 0);
  const close = () => pan.spring(width).then(() => {
    if (allowBack) navigation.goBack();
  });
  const {
    width
  } = useGesture(el, {
    onCapture: e => {
      if (!allowBack) return;
      if (disableGestures) return;
      return e.direction === 'x' && e.distance > 0;
    },
    onMove: e => {
      pan.setValue(Math.max(0, e.distance));
    },
    onUp: e => {
      if (e.flick === -1) return close();
      pan.spring(0); // Return to start
    }
  });

  // Trigger animation on visibility change
  useEffect(() => {
    if (!width || !animateIn) return;
    pan.spring(isVisible ? 0 : width);
  }, [animateIn, isVisible, width]);
  useEffect(() => {
    return pan.on(value => {
      if (el.current) el.current.style.transform = `translateX(${value}px)`;
      if (shadeEl.current) shadeEl.current.progress(value, width);
    });
  }, [width]);
  const dragOver = e => {
    e.preventDefault();
  };
  const startDrag = e => {
    setDropping(true);
  };
  const cancelDrag = e => {
    setDropping(false);
  };
  const drop = e => {
    setDropping(false);
    onDrop(e);
  };
  const renderHeader = () => {
    if (HeaderComponent === null) return null;
    if (HeaderComponent) return HeaderComponent;
    return /*#__PURE__*/React.createElement(ScreenHeader, {
      title: title,
      subtitle: subtitle,
      presentation: "card",
      SearchComponent: SearchComponent,
      onClose: close,
      headerRight: headerRight
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "layer"
  }, ShadeComponent ? /*#__PURE__*/React.createElement(ShadeComponent, {
    ref: shadeEl
  }) : null, /*#__PURE__*/React.createElement("div", {
    className: c('card', animateIn && 'animate', className),
    ref: el,
    onDragOver: onDrop && dragOver,
    onDragEnter: onDrop && startDrag,
    onDragLeave: onDrop && cancelDrag,
    onDrop: onDrop && drop
  }, renderHeader(), /*#__PURE__*/React.createElement("div", {
    className: "card-body",
    children: children
  }), footer, dropping ? /*#__PURE__*/React.createElement(Placeholder, {
    className: "drop-zone",
    icon: "upload",
    title: "Upload"
  }) : null));
});

const CheckBox = ({
  active,
  undetermined
}) => /*#__PURE__*/React.createElement("div", {
  className: c('toggle-check', active && 'active', undetermined && 'undetermined')
}, /*#__PURE__*/React.createElement(Icon, {
  icon: undetermined ? 'horizontal_rule' : active ? 'check' : null
}));

const CircleCheck = ({
  active
}) => {
  return /*#__PURE__*/React.createElement("div", {
    className: c('circle-check', active && 'active')
  }, /*#__PURE__*/React.createElement(Icon, {
    icon: "check"
  }));
};

const ConnectionIndicator = ({
  status
}) => {
  if (status === 'connected') return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "connection-indicator"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bubble"
  }, /*#__PURE__*/React.createElement(ActivityIndicator, null), status));
};

const CornerDialog = ({
  title,
  children,
  isVisible,
  onClose
}) => {
  if (!isVisible) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "corner-dialog"
  }, /*#__PURE__*/React.createElement("div", {
    className: "corner-dialog-title"
  }, title, /*#__PURE__*/React.createElement(Icon, {
    icon: "close",
    onClick: onClose
  })), children);
};

let origin = {};
const Reveal = /*#__PURE__*/forwardRef(({
  children,
  title,
  headerRight,
  onClose,
  isVisible,
  animateIn,
  className
}, ref) => {
  const el = useRef();
  const innerEl = useRef();
  const pan = useAnimatedValue(animateIn ? 0 : 1);
  const close = () => navigation.goBack(1);
  useImperativeHandle(ref, () => ({
    close
  }));
  const {
    width,
    height
  } = useGesture(el, {
    onCapture(e) {
      return e.direction === 'x' && e.distance > 0;
    },
    onMove(e) {
      pan.setValue(1 - e.distance / e.size);
    },
    onUp(e) {
      if (e.flick === -1) return close();
      pan.spring(1);
    }
  });
  useEffect(() => {
    if (!animateIn) return;
    if (isVisible) {
      pan.spring(1);
    } else {
      pan.spring(0);
    }
  }, [animateIn, isVisible]);
  useEffect(() => {
    return pan.on(val => {
      const inverse = 1 - val;
      const revealX = origin.x * inverse;
      const revealY = origin.y * inverse;
      el.current.style.transform = `translate(${revealX}px, ${revealY}px)`;
      el.current.style.width = toPercent(val);
      el.current.style.height = toPercent(val);
      innerEl.current.style.transform = `translate(${-1 * revealX}px, ${-1 * revealY}px)`;
      innerEl.current.style.opacity = val;

      // el.current.style.borderRadius = lerp(val, 50, 0) + 'px';
    });
  }, [width, height]);
  return /*#__PURE__*/React.createElement("div", {
    className: "layer reveal",
    ref: el
  }, /*#__PURE__*/React.createElement("div", {
    className: c('card reveal-content', className),
    ref: innerEl
  }, /*#__PURE__*/React.createElement(ScreenHeader, {
    title: title,
    onClose: close,
    headerRight: headerRight,
    presentation: "card"
  }), /*#__PURE__*/React.createElement("div", {
    className: "card-body",
    children: children
  })));
});
const setRevealOrigin = (x, y) => Object.assign(origin, {
  x,
  y
});

const setOrigin = e => {
  const rect = e.currentTarget.getBoundingClientRect();
  setRevealOrigin((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2);
};
const DashboardIcon = ({
  title,
  icon,
  href
}) => /*#__PURE__*/React.createElement(Touchable, {
  href: href,
  className: "springboard-icon",
  onClick: setOrigin
}, /*#__PURE__*/React.createElement("div", {
  className: "icon-frame"
}, /*#__PURE__*/React.createElement(Icon, {
  icon: icon
})), /*#__PURE__*/React.createElement("div", {
  className: "springboard-icon-name"
}, title));

const Dropdown = ({
  position,
  button,
  content
}) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const dismiss = e => {
      const insideDropdown = e.composedPath().some(el => {
        return el.classList && el.classList.contains('dropdown-content');
      });
      // if (debug) console.log('Debug', insideDropdown ? 'Inside' : 'Outside');
      if (!insideDropdown) setVisible(false);
    };
    setTimeout(() => {
      window.addEventListener('click', dismiss, {
        passive: false
      });
    }, 0);
    return () => window.removeEventListener('click', dismiss);
  }, [visible]);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "dropdown"
  }, /*#__PURE__*/React.createElement("div", {
    children: button,
    className: "dropdown-button",
    onClick: () => {
      console.log('show');
      setVisible(true);
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: c('dropdown-content', position || 'top-right', visible ? 'visible' : 'hidden'),
    children: content
  })));
};

const DropdownItem = ({
  title,
  icon,
  onClick,
  href,
  disabled,
  children,
  active
}) => /*#__PURE__*/React.createElement(TouchableRow, {
  className: "dropdown-item",
  onClick: onClick,
  disabled: disabled,
  active: active,
  children: children,
  href: href,
  leftIcon: icon,
  title: title
});

const Fab = ({
  icon,
  title,
  loading,
  disabled,
  active = true,
  href,
  onPress
}) => /*#__PURE__*/React.createElement(Touchable, {
  className: c('fab', !title && 'round'),
  loading: loading,
  disabled: disabled,
  active: active,
  onClick: onPress,
  href: href
}, loading ? /*#__PURE__*/React.createElement(ActivityIndicator, {
  color: "#000"
}) : /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement(Icon, {
  icon: icon
}), title && /*#__PURE__*/React.createElement("div", {
  className: "fab-title"
}, title)));

const Emoji = ({
  emoji
}) => /*#__PURE__*/React.createElement("span", {
  className: "emoji",
  children: emoji
});

const FullScreen = ({
  title,
  children,
  footer,
  headerRight,
  SearchComponent
}) => {
  const el = useRef();
  const pan = useAnimatedValue(0);
  const close = () => {
    pan.spring(0).then(() => navigation.goBack());
  };
  useEffect(() => {
    pan.spring(1);
    return pan.on(value => {
      el.current.style.opacity = value;
    });
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    className: "fullscreen",
    ref: el
  }, /*#__PURE__*/React.createElement(ScreenHeader, {
    title: title,
    presentation: "full",
    onClose: close,
    headerRight: headerRight,
    SearchComponent: SearchComponent
  }), /*#__PURE__*/React.createElement(ScrollView, {
    className: "card-body"
  }, children), footer);
};

class Animation {
  constructor(initialValue) {
    this.listeners = [];
    this.values = initialValue;
    this.initialValues = clone(initialValue);
  }
  set = (values, end = true) => {
    Object.assign(this.values, values);
    if (end) this.end();
    this.listeners.forEach(fn => fn(this.values));
  };
  spring = (finalValues, duration = Animation.defaultDuration) => new Promise(resolve => {
    if (sameObject(finalValues, this.values)) return resolve(); // cancel unnecessary animation

    const t0 = this.id = performance.now(); // a unique id for this animation lifecycle
    const oldValues = clone(this.values);
    const animate = t => {
      if (t0 !== this.id) return;
      const elapsed = Math.max(0, t - t0); // time hack
      if (elapsed >= duration) {
        this.set(finalValues, true);
        resolve();
      } else {
        const intermediateValues = Object.keys(finalValues).reduce((acc, key) => {
          acc[key] = oldValues[key] + (finalValues[key] - oldValues[key]) * easeOutCubic(elapsed / duration);
          // console.log(key, oldValues[key], acc[key]);
          return acc;
        }, {});
        this.set(intermediateValues, false);
        requestAnimationFrame(animate);
      }
    };
    animate(t0);
  });
  on = fn => {
    this.listeners.push(fn);
    return () => this.listeners = this.listeners.filter(i => i !== fn);
  };
  stop = () => {
    delete this.id;
  };
  end = () => {
    delete this.id;
    this.initialValues = clone(this.values);
  };
}
Animation.defaultDuration = 300;
const useAnimation = initialValue => useMemo(() => {
  return new Animation(initialValue);
}, []);

const GalleryItem = ({
  children,
  onClose
}) => {
  const el = useRef(null);
  const anim = useAnimation({
    zoom: 1,
    panX: 0,
    panY: 0
  });
  useEffect(() => {
    return anim.on(val => {
      el.current.style.transform = `scale(${val.zoom}) translateX(${val.panX / val.zoom}px) translateY(${val.panY / val.zoom}px)`;
    });
  }, []);
  const getLimits = () => {
    const img = el.current.querySelector('img');

    // console.log('Zoomed:', img.clientHeight * anim.values.zoom, 'Regular:', img.clientHeight);

    const width = img.clientWidth * anim.values.zoom;
    const height = img.clientHeight * anim.values.zoom;
    return {
      'maxPanX': width > el.current.clientWidth ? (width - el.current.clientWidth) / 2 : 0,
      'maxPanY': height > el.current.clientHeight ? (height - el.current.clientHeight) / 2 : 0
    };
  };
  useGesture(el, {
    onCapture(e) {
      const {
        maxPanX,
        maxPanY
      } = getLimits();
      if (e.direction === 'x' && maxPanX > 0) return true;
      if (e.direction === 'y' && maxPanY > 0) return true;
      return !!e.pinch;
    },
    onPinch(e) {
      // console.log('Pinch:', anim.initialValues.zoom, e.scale);
      const {
        maxPanX,
        maxPanY
      } = getLimits();
      const zoom = anim.initialValues.zoom * e.scale;
      anim.set({
        'zoom': zoom,
        'panX': clamp(anim.initialValues.panX, -maxPanX, maxPanX),
        'panY': clamp(anim.initialValues.panY, -maxPanY, maxPanY)
      }, false);
    },
    onMove(e) {
      if (anim.values.zoom <= 1) return;
      const {
        maxPanX,
        maxPanY
      } = getLimits();
      anim.set({
        'panX': maxPanX && clamp(anim.initialValues.panX + e.d.x, -maxPanX, maxPanX),
        'panY': maxPanY && clamp(anim.initialValues.panY + e.d.y, -maxPanY, maxPanY)
      }, false);
    },
    onUp(e) {
      if (anim.values.zoom < 1) return anim.spring({
        'zoom': 1,
        'panX': 0,
        'panY': 0
      });
      if (anim.values.zoom > 3) return anim.spring({
        'zoom': 3
      });
      anim.end();
    },
    onDoubleTap() {
      if (anim.values.zoom === 1) {
        anim.spring({
          'zoom': 3
        });
      } else {
        anim.spring({
          'zoom': 1,
          'panX': 0,
          'panY': 0
        });
      }
    }
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    className: "gallery-item",
    ref: el,
    children: children
  });
};

const HeaderButton = ({
  icon,
  title,
  badge,
  loading,
  disabled,
  onClick,
  active,
  href
}) => /*#__PURE__*/React.createElement(Touchable, {
  className: c('header-button center', title === 'Cancel' && 'header-cancel'),
  onClick: onClick,
  loading: loading,
  disabled: disabled,
  active: active,
  href: href
}, icon ? /*#__PURE__*/React.createElement(Icon, {
  icon: icon
}) : null, title ? /*#__PURE__*/React.createElement("span", null, title) : null, badge ? /*#__PURE__*/React.createElement("span", {
  className: "badge"
}, badge) : null);

const Image = ({
  ar,
  url,
  alt,
  className,
  children,
  base64Png
}) => {
  const renderImg = () => {
    if (url) return /*#__PURE__*/React.createElement("img", {
      src: url,
      className: "img-real",
      alt: alt,
      draggable: false
    });
    if (base64Png) return /*#__PURE__*/React.createElement("img", {
      src: `data:image/png;base64,${base64Png}`
    });
    return /*#__PURE__*/React.createElement("div", {
      className: "img-real",
      alt: alt,
      draggable: false
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    className: c('img', className)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: (ar || 1) * 100 + '%'
    }
  }), renderImg(), children ? /*#__PURE__*/React.createElement("div", {
    className: "img-inside"
  }, children) : null);
};

const List = ({
  title,
  items = [],
  keyExtractor = r => r._id,
  renderItem,
  loading,
  className,
  ListEmptyComponent,
  HeaderComponent,
  children,
  showSeparators = true
}) => {
  const renderList = () => {
    if (loading || !items) return null;
    if (ListEmptyComponent && items.length === 0) return ListEmptyComponent;
    return items.map((item, i) => /*#__PURE__*/React.createElement(Fragment, {
      key: keyExtractor(item)
    }, renderItem(item, i), showSeparators && i < items.length - 1 && /*#__PURE__*/React.createElement("hr", null)));
  };
  const renderChild = (child, i) => /*#__PURE__*/React.createElement(Fragment, {
    key: i
  }, child, i < children.length - 1 && /*#__PURE__*/React.createElement("hr", null));
  return /*#__PURE__*/React.createElement("div", {
    className: c('list', className)
  }, title ? /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "list-title"
  }, title), /*#__PURE__*/React.createElement("hr", null)) : null, HeaderComponent, items.length || children ? /*#__PURE__*/React.createElement("div", {
    className: "list-body"
  }, renderList(), Children.map(children, renderChild)) : ListEmptyComponent);
};

const modalState = createBus([]);
const renderModal = modal => /*#__PURE__*/React.createElement("div", {
  key: modal.id,
  className: "layer",
  children: modal.children
});
const Modal = () => useBus(modalState).map(renderModal);
const showModal = children => modalState.update([...modalState.state, {
  'id': Math.random(),
  'children': children
}]);
const hideModal = () => {
  modalState.update([]);
};

const state$1 = createBus([]);
const Notification = ({
  title,
  body,
  onDismiss = () => null
}) => {
  const el = useRef();
  const pan = useAnimatedValue(0);
  useGesture(el, {
    onCapture(e) {
      return e.direction === 'x';
    },
    onMove(e) {
      pan.setValue(e.distance / e.size);
    },
    onUp(e) {
      if (e.flick) {
        pan.spring(-e.flick);
      } else {
        pan.spring(0);
      }
    }
  }, []);
  const dismiss = () => {
    pan.spring(1).then(onDismiss);
  };
  useEffect(() => {
    return pan.on(val => {
      el.current.style.opacity = 1 - Math.abs(val);
      el.current.style.transform = `translateX(${toPercent(val)})`;
    });
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    className: "notification",
    ref: el
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "notification-title"
  }, title), /*#__PURE__*/React.createElement("div", {
    className: "notification-body"
  }, body)), /*#__PURE__*/React.createElement(Touchable, {
    onClick: dismiss
  }, /*#__PURE__*/React.createElement(Icon, {
    icon: "close"
  })));
};
const Notifications = () => {
  const notifications = useBus(state$1);
  if (notifications.length === 0) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "layer notifications-container"
  }, notifications.map(data => /*#__PURE__*/React.createElement(Notification, data)));
};
const showNotification = data => {
  state$1.update([...state$1.state, {
    key: randomId(),
    ...data
  }]);
};

const PercentBar = ({
  percent
}) => /*#__PURE__*/React.createElement("div", {
  className: "percent-bar"
}, /*#__PURE__*/React.createElement("div", {
  className: "percent-bar-inner",
  style: {
    width: `${percent * 100}%`
  }
}));

const Pill = ({
  title,
  color,
  onClick
}) => /*#__PURE__*/React.createElement(Touchable, {
  className: "pill",
  onClick: onClick,
  style: {
    backgroundColor: color
  }
}, title);

const FilterButton = ({
  title,
  LeftComponent,
  caret = true,
  checked,
  active,
  href,
  onPress
}) => /*#__PURE__*/React.createElement(Touchable, {
  className: "filter-button",
  onClick: onPress,
  active: active,
  interactive: true,
  href: href
}, LeftComponent, title ? /*#__PURE__*/React.createElement("div", {
  className: "filter-button-title"
}, title) : null, caret ? /*#__PURE__*/React.createElement(Icon, {
  className: "filter-button-caret",
  icon: "expand_more"
}) : /*#__PURE__*/React.createElement(CheckBox, {
  active: checked
}));

const state = createBus();
const Toast = () => {
  const message = useBus(state);
  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => state.update(null), 2000);
    return () => clearTimeout(timeout);
  }, [message]);
  if (!message) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "toast-container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "toast",
    children: message
  }));
};
const toast = state.update;

const PoonOverlays = () => /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement(Notifications, null), /*#__PURE__*/React.createElement(Modal, null), /*#__PURE__*/React.createElement(ActionSheet, null), /*#__PURE__*/React.createElement(Alert, null), /*#__PURE__*/React.createElement(Toast, null));

const ProgressIndicator = () => /*#__PURE__*/React.createElement("div", {
  className: "progress-indicator"
});

const ProgressRing = ({
  color = '#fff',
  size = 20,
  percent,
  spinning,
  completedIcon = 'check'
}) => {
  if (spinning || !percent) return /*#__PURE__*/React.createElement(ProgressIndicator, null);
  if (percent === 1) return /*#__PURE__*/React.createElement(Icon, {
    icon: completedIcon
  });
  const r = size / 2;
  const ri = r - 1; // inner radius
  const c = ri * 2 * Math.PI; // circumference
  const strokeDashoffset = c - percent * c;
  return /*#__PURE__*/React.createElement("svg", {
    height: size,
    width: size
  }, /*#__PURE__*/React.createElement("circle", {
    stroke: color,
    opacity: .3,
    fill: "transparent",
    strokeWidth: 2,
    r: ri,
    cx: r,
    cy: r
  }), /*#__PURE__*/React.createElement("circle", {
    strokeDasharray: c + ' ' + c,
    style: {
      strokeDashoffset,
      transform: 'rotate(-90deg)',
      transformOrigin: '50% 50%'
    },
    stroke: color,
    fill: "transparent",
    strokeWidth: 2,
    r: ri,
    cx: r,
    cy: r
  }));
};

const RadioButton = ({
  active,
  icon,
  title,
  elaboration,
  subtitle,
  value,
  disabled,
  onClick,
  children
}) => /*#__PURE__*/React.createElement(TouchableRow, {
  onClick: () => {
    onClick(value);
  },
  disabled: disabled,
  className: "radio-btn",
  active: active
}, /*#__PURE__*/React.createElement("div", {
  className: "radio-top"
}, /*#__PURE__*/React.createElement("div", {
  className: "dot"
}, /*#__PURE__*/React.createElement("div", {
  className: "dot-inside"
})), icon && /*#__PURE__*/React.createElement(Icon, {
  icon: icon
}), /*#__PURE__*/React.createElement("div", {
  className: "radio-title"
}, title)), children && /*#__PURE__*/React.createElement("div", {
  className: "radio-subtitle"
}, children), subtitle && /*#__PURE__*/React.createElement("div", {
  className: "radio-subtitle"
}, subtitle), active && elaboration && /*#__PURE__*/React.createElement("div", {
  className: "radio-subtitle",
  children: elaboration
}));

const SegmentedItem = /*#__PURE__*/forwardRef(({
  item,
  isLast,
  active,
  onChange,
  index
}, ref) => /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement(Touchable, {
  children: item.name,
  onClick: () => onChange(item.value),
  active: active,
  ref: ref
}), isLast ? null : /*#__PURE__*/React.createElement("div", {
  className: "separator"
})));
const SegmentedController = ({
  options,
  value,
  onChange
}) => {
  const refs = useRef([]);
  const indicator = useRef();
  const index = options.findIndex(item => item.value === value);
  const left = useAnimatedValue(0);
  const width = useAnimatedValue(0);
  useEffect(() => {
    left.on(val => indicator.current.style.transform = `translateX(${val}px)`);
    width.on(val => indicator.current.style.width = `${val}px`);
  }, []);
  useEffect(() => {
    const el = refs.current[index]; // element to copy attributes from
    if (width.value === 0) {
      left.setValue(el.offsetLeft);
      width.setValue(el.offsetWidth);
    } else {
      left.spring(el.offsetLeft);
      width.spring(el.offsetWidth);
    }
  }, [index]);
  return /*#__PURE__*/React.createElement("div", {
    className: "segmented"
  }, /*#__PURE__*/React.createElement("div", {
    className: "segmented-indicator",
    ref: indicator
  }), options.map((item, i) => /*#__PURE__*/React.createElement(SegmentedItem, {
    key: item.value,
    item: item,
    index: i,
    isLast: i === options.length - 1,
    active: index === i,
    onChange: onChange,
    ref: el => refs.current[i] = el
  })));
};

const TabularRow = ({
  leftText,
  rightText
}) => /*#__PURE__*/React.createElement("div", {
  className: "tabular-row"
}, /*#__PURE__*/React.createElement("div", {
  className: "tabular-row-left"
}, leftText), /*#__PURE__*/React.createElement("div", {
  className: "tabular-row-right"
}, rightText));

const cyrb53 = (str, seed = 0) => {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507);
  h1 ^= Math.imul(h2 ^ h2 >>> 13, 3266489909);
  h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507);
  h2 ^= Math.imul(h1 ^ h1 >>> 13, 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

const f = 360 / Math.pow(2, 53);
const hashColor = tag => {
  return `hsl(${180 - f * cyrb53(tag)}, 100%, 50%)`;
};
const Tag = /*#__PURE__*/memo(({
  tag,
  count
}) => {
  const fg = hashColor(tag);
  return /*#__PURE__*/React.createElement("div", {
    className: "tag",
    style: {
      borderColor: fg,
      color: fg
    },
    children: `${tag}  ${count || ''}`
  });
});

const Select = ({
  options,
  value,
  disabled,
  autoComplete,
  onChangeValue
}) => {
  const renderOptions = () => {
    if (options instanceof Array) return options.map(option => /*#__PURE__*/React.createElement("option", {
      key: option.value,
      value: option.value,
      children: option.name
    }));
    Object.keys(options).map(key => /*#__PURE__*/React.createElement("option", {
      key: key,
      value: key,
      children: options[key]
    }));
  };
  return /*#__PURE__*/React.createElement("select", {
    className: c('text select', disabled && 'disabled'),
    onChange: e => onChangeValue(e.target.value),
    value: value,
    disabled: disabled,
    autoComplete: autoComplete
  }, renderOptions());
};

const TouchableHighlight = ({
  href,
  onClick,
  children,
  disabled,
  className
}) => /*#__PURE__*/React.createElement(Touchable, {
  className: c('touchable-highlight', disabled && 'disabled', className),
  onClick: onClick,
  href: href,
  children: children
});

const PagerDot = ({
  pan,
  i
}) => {
  const el = useRef();
  useEffect(() => {
    return pan.on(value => {
      const dist = Math.abs(i - value);
      el.current.style.opacity = Math.max(.5, 1 - dist);
    });
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    className: "pager-dot",
    ref: el,
    style: {
      opacity: pan.value === i ? 1 : .5
    }
  });
};
const PagerTabTitle = ({
  title,
  i,
  pan,
  onPress
}) => {
  const el = useRef();
  useEffect(() => {
    return pan.on(value => {
      const dist = Math.abs(i - value);
      el.current.style.opacity = Math.max(0.5, 1 - dist);
    });
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    children: title,
    className: "pager-tabs-title",
    onClick: () => onPress(i),
    ref: el,
    style: {
      opacity: pan.value === i ? 1 : .5
    }
  });
};
const ViewPager = /*#__PURE__*/forwardRef(({
  titles,
  children,
  vertical,
  dots,
  className,
  page = 0,
  gap = 0
}, ref) => {
  const pan = useAnimatedValue(page);
  const indicatorEl = useRef();
  const scrollerEl = useRef();
  const refs = useRef({}).current;
  const lastIndex = Children.count(children) - 1;
  const orientation = vertical ? 'y' : 'x';
  const clamp = createClamp(0, lastIndex);
  useImperativeHandle(ref, () => ({
    scrollToPage: i => pan.spring(clamp(i))
  }));
  const {
    width,
    height
  } = useGesture(scrollerEl, {
    pointerControls: true,
    onCapture(e) {
      if (e.direction === orientation) {
        if (e.distance < 0) return true; // Don't capture at the left edge
        return refs.initPan - e.distance / e.size > 0;
      }
    },
    onDown(e) {
      pan.end();
      refs.currentPage = Math.round(pan.value);
      refs.initPan = pan.value;
    },
    onMove(e) {
      const val = clamp(refs.initPan - e.distance / e.size);
      pan.setValue(val);
    },
    onPan(components) {
      // ScrollWheel
      const e = components[orientation];
      const pos = pan.value - e.distance / e.size;
      pan.setValue(clamp(pos));
    },
    onUp(e) {
      if (e.flick) {
        const page = clamp(refs.currentPage + e.flick);
        pan.spring(page, e.flickMs);
      } else {
        // Snap back to current page
        const page = clamp(Math.round(pan.value));
        pan.spring(page);
      }
    }
  }, [children]);
  useEffect(() => {
    pan.spring(page);
  }, [page]);
  useEffect(() => {
    return pan.on(value => {
      if (vertical) {
        scrollerEl.current.style.transform = `translateY(-${value * height + gap * value}px)`;
      } else {
        scrollerEl.current.style.transform = `translateX(-${value * width + gap * value}px)`;
      }
      if (indicatorEl.current) indicatorEl.current.style.transform = `translateX(${toPercent(value)})`;
    });
  }, [vertical, height, width]);
  return /*#__PURE__*/React.createElement("div", {
    className: c('pager', vertical ? 'vertical' : 'horizontal', className)
  }, titles ? /*#__PURE__*/React.createElement("div", {
    className: "pager-tabs"
  }, titles.map((title, i) => /*#__PURE__*/React.createElement(PagerTabTitle, {
    key: i,
    title: title,
    pan: pan,
    i: i,
    onPress: pan.spring
  })), width ? /*#__PURE__*/React.createElement("div", {
    className: "pager-tabs-indicator",
    ref: indicatorEl,
    style: {
      width: toPercent(1 / titles.length)
    }
  }) : null) : null, /*#__PURE__*/React.createElement("div", {
    className: "pager-scroller"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pager-canvas",
    ref: scrollerEl,
    style: {
      transform: vertical ? `translateY(calc(-${toPercent(page)} - ${page * gap}px))` : `translateX(calc(-${toPercent(page)} - ${page * gap}px))`
    }
  }, Children.map(children, (child, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "pager-page",
    children: child,
    style: vertical ? {
      marginBottom: gap
    } : {
      marginRight: gap
    }
  })))), dots ? /*#__PURE__*/React.createElement("div", {
    className: "pager-dots"
  }, Children.map(children, (child, i) => /*#__PURE__*/React.createElement(PagerDot, {
    key: i,
    pan: pan,
    i: i
  }))) : null);
});

const autoCompleteMap = {
  'code': 'one-time-code'
};
const typeMap = {
  'phone': 'tel',
  'code': 'tel'
};
const TextInput = /*#__PURE__*/forwardRef(({
  placeholder,
  value = '',
  icon,
  type = 'text',
  dnt,
  disabled,
  rows = 0,
  className,
  onFocus,
  autoComplete,
  onClick,
  maxLength,
  id,
  onChangeText = () => null,
  autoFocus,
  loading,
  RightComponent,
  countryCode,
  onChangePhone,
  lowerCase,
  min,
  max,
  onPressCountry,
  countries
}, ref) => {
  const [_value, _setValue] = useState(value); // internal value

  const renderInput = () => {
    let tagName = type === 'textarea' || rows ? 'textarea' : 'input';
    const changeText = e => {
      let value = e.target.value;
      _setValue(value);
      if (type === 'phone') {
        value = value.replace(/[^0-9]/g, '');
      } else {
        if (lowerCase) value = value.toLowerCase();
        if (maxLength) value = value.slice(0, maxLength);
        if (type === 'username') value = value.replace(/\s/g, '');
      }
      onChangeText(value);
    };
    const renderValue = value => {
      if (type === 'phone' && countryCode) {
        const country = countries.find(r => r.code === countryCode);
        const chars = value.split('');
        return country.example.split('').map(char => {
          if (chars.length) return char === 'X' ? chars.shift() : char;
        }).filter(Boolean).join('');
      }
      return value;
    };
    return /*#__PURE__*/createElement(tagName, {
      'type': typeMap[type] || type,
      'autoComplete': autoCompleteMap[type],
      'maxLength': maxLength,
      'className': c('text', disabled && 'disabled', dnt && 'fs-hide', className),
      'readOnly': disabled,
      'onChange': changeText,
      'value': renderValue(value),
      'autoCapitalize': lowerCase && 'none',
      placeholder,
      rows,
      onFocus,
      onClick,
      id,
      autoFocus,
      ref,
      min,
      max
    });
  };
  const renderIcon = () => {
    if (icon) return /*#__PURE__*/React.createElement(Icon, {
      className: "text-input-icon",
      icon: icon
    });
    if (type === 'username') return /*#__PURE__*/React.createElement("span", {
      className: "text-input-icon"
    }, "@");
    if (type === 'search') return /*#__PURE__*/React.createElement(Icon, {
      className: "text-input-icon",
      icon: "search"
    });
  };
  const renderClearButton = () => {
    if (type !== 'search') return null;
    if (value) return /*#__PURE__*/React.createElement(Touchable, {
      onClick: () => onChangeText('')
    }, /*#__PURE__*/React.createElement(Icon, {
      icon: "cancel",
      className: "text-input-clear"
    }));
  };
  const renderSpinner = () => {
    if (!loading) return null;
    return /*#__PURE__*/React.createElement("div", {
      className: "text-input-spinner"
    }, /*#__PURE__*/React.createElement(ActivityIndicator, {
      size: 18
    }));
  };
  const renderCountryButton = () => {
    const country = countries ? countries.find(r => r.code === countryCode) : null;
    if (!country) return null; // fix me??

    return /*#__PURE__*/React.createElement(Touchable, {
      className: "text-input-country",
      onClick: onPressCountry
    }, /*#__PURE__*/React.createElement("span", {
      className: "emoji"
    }, country.flag), country.prefix);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "text-input"
  }, type === 'phone' && renderCountryButton(), renderIcon(), renderInput(), icon ? /*#__PURE__*/React.createElement("img", {
    className: "text-input-icon",
    src: icon
  }) : null, RightComponent, renderSpinner(), renderClearButton());
});

const Window = /*#__PURE__*/forwardRef(({
  children,
  title,
  search,
  onChangeSearch,
  searchLoading,
  headerRight,
  onClose,
  isVisible,
  presentation = 'modal'
}, ref) => {
  const shadeEl = useRef();
  const el = useRef();
  const pan = useAnimatedValue(0);
  const close = () => {
    if (onClose) {
      pan.spring(0).then(onClose);
    } else {
      navigation.goBack(1);
    }
  };
  useImperativeHandle(ref, () => ({
    close
  }));
  const {
    height
  } = useGesture(el, {
    onCapture: e => {
      return e.direction === 'y' && e.distance > 0;
    },
    onMove: e => {
      pan.setValue(height - Math.max(0, e.distance));
    },
    onUp: e => {
      if (e.flick === -1) return close();
      pan.spring(e.size);
    }
  });
  useEffect(() => {
    if (!height) return;
    if (isVisible || onClose) {
      // onClose is here because the window is in a modal if there is an onClose
      pan.spring(height);
    } else {
      pan.spring(0);
    }
  }, [isVisible, height]);
  useEffect(() => {
    const cards = document.querySelectorAll('.card');
    return pan.on(value => {
      const percent = value / height;
      if (el.current) el.current.style.transform = `translateY(-${value}px)`;
      if (shadeEl.current) {
        shadeEl.current.style.display = value ? 'block' : 'none';
        shadeEl.current.style.opacity = value / height;
      }
      [...cards].forEach(el => {
        el.parentElement.style.transform = `scale(${1 - .04 * percent})`;
      });
    });
  }, [height]);
  return /*#__PURE__*/React.createElement("div", {
    className: "layer"
  }, /*#__PURE__*/React.createElement("div", {
    className: `shade shade-${presentation}`,
    ref: shadeEl
  }), /*#__PURE__*/React.createElement("div", {
    className: `window window-${presentation}`,
    ref: el
  }, presentation === 'modal' ? /*#__PURE__*/React.createElement(ScreenHeader, {
    title: title,
    presentation: "modal",
    onClose: close,
    SearchComponent: onChangeSearch ? /*#__PURE__*/React.createElement("div", {
      className: "header-search"
    }, /*#__PURE__*/React.createElement(TextInput, {
      placeholder: "Search",
      type: "search",
      value: search,
      onChangeText: onChangeSearch,
      loading: searchLoading
    })) : null,
    headerRight: headerRight
  }) : null, /*#__PURE__*/React.createElement("div", {
    className: "card-body",
    children: children
  })));
});

const cache = new Map();
const memoize = func => function (...args) {
  const key = args[0];
  if (!cache.has(key)) cache.set(key, func.apply(this, args));
  return cache.get(key);
};
const loadCss = memoize(url => new Promise(resolve => {
  const el = document.createElement('link');
  el.setAttribute('rel', 'stylesheet');
  el.setAttribute('href', url);
  el.onload = () => resolve();
  document.head.appendChild(el);
}));
const loadScript = memoize((url, windowKey) => new Promise(resolve => {
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.async = true;
  script.src = url;
  script.onload = () => resolve(window[windowKey]);
  document.head.appendChild(script);
}));

// Sync Viewport Size
const syncSize = ({
  width,
  height
}) => {
  document.documentElement.style.setProperty('--viewport-width', `${width}px`);
  document.documentElement.style.setProperty('--viewport-height', `${height}px`);
};
syncSize({
  width: document.documentElement.clientWidth,
  height: document.documentElement.clientHeight
});
new ResizeObserver(entries => {
  syncSize(entries[0].contentRect);
}).observe(document.documentElement);

// Virtual Keyboard API
const vk = navigator.virtualKeyboard;
const useVirtualKeyboard = () => useEffect(() => {
  if (!vk) return;
  vk.overlaysContent = true;
  return () => vk.overlaysContent = false;
}, []);

export { ActionSheet, ActivityIndicator, Alert, AnimatedValue, Animation, Avatar, BottomSheet, BreadCrumbs, Button, Card, CheckBox, CircleCheck, ConnectionIndicator, CornerDialog, DashboardIcon, Dropdown, DropdownItem, Emoji, Fab, FilterButton, FullScreen, GalleryItem, HeaderButton, Icon, Image, List, Modal, Notifications, PercentBar, Pill, Placeholder, PoonOverlays, ProgressIndicator, ProgressRing, PullIndicator, RadioButton, Reveal, ScreenHeader, ScrollView, SegmentedController, Select, Shade, TabularRow, Tag, TextInput, Toast, Touchable, TouchableHighlight, TouchableRow, ViewPager, Window, bounce, c, clamp, clone, createClamp, cyrb53, easeOutCubic, hideModal, lerp, loadCss, loadScript, memoize, modalState, sameObject, setRevealOrigin, showActionSheet, showAlert, showModal, showNotification, toPercent, toast, useAnimatedValue, useAnimation, useGesture, useSize, useVirtualKeyboard };
