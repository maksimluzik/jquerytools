/*!
 * jQuery Tools v1.2.7 - The missing UI library for the Web
 *
 * overlay/overlay.js
 * overlay/overlay.apple.js
 * toolbox/toolbox.expose.js
 *
 * NO COPYRIGHTS OR LICENSES. DO WHAT YOU LIKE.
 *
 * http://flowplayer.org/tools/
 *
 */
(function ($) {

    // static constructs
    $.tools = $.tools || { version: '@VERSION' };

    $.tools.overlay = {

        addEffect: function (name, loadFn, closeFn) {
            effects[name] = [loadFn, closeFn];
        },

        conf: {
            close: null,
            closeOnClick: true,
            closeOnEsc: true,
            closeSpeed: 'fast',
            effect: 'default',

            // since 1.2. fixed positioning not supported by IE6
            fixed: !/msie/.test(navigator.userAgent.toLowerCase()) || navigator.appVersion > 6,

            left: 'center',
            load: false, // 1.2
            mask: null,
            oneInstance: true,
            speed: 'normal',
            target: null, // target element to be overlayed. by default taken from [rel]
            top: '10%'
        }
    };


    var instances = [], effects = {};

    // the default effect. nice and easy!
    $.tools.overlay.addEffect('default',

        /*
         onLoad/onClose functions must be called otherwise none of the
         user supplied callback methods won't be called
         */
        function (pos, onLoad) {

            var conf = this.getConf(),
                w = $(window);

            if (!conf.fixed) {
                pos.top += w.scrollTop();
                pos.left += w.scrollLeft();
            }

            pos.position = conf.fixed ? 'fixed' : 'absolute';
            this.getOverlay().css(pos).fadeIn(conf.speed, onLoad);

        }, function (onClose) {
            this.getOverlay().fadeOut(this.getConf().closeSpeed, onClose);
        }
    );


    function Overlay(trigger, conf) {

        // private variables
        var self = this,
            fire = trigger.add(self),
            w = $(window),
            closers,
            overlay,
            opened,
            maskConf = $.tools.expose && (conf.mask || conf.expose),
            uid = Math.random().toString().slice(10);


        // mask configuration
        if (maskConf) {
            if (typeof maskConf == 'string') { maskConf = { color: maskConf }; }
            maskConf.closeOnClick = maskConf.closeOnEsc = false;
        }

        // get overlay and trigger
        var jq = conf.target || trigger.attr("rel");
        overlay = jq ? $(jq) : null || trigger;

        // overlay not found. cannot continue
        if (!overlay.length) { throw "Could not find Overlay: " + jq; }

        // trigger's click event
        if (trigger && trigger.index(overlay) == -1) {
            trigger.click(function (e) {
                self.load(e);
                return e.preventDefault();
            });
        }

        // API methods
        $.extend(self, {

            load: function (e) {

                // can be opened only once
                if (self.isOpened()) { return self; }

                // find the effect
                var eff = effects[conf.effect];
                if (!eff) { throw "Overlay: cannot find effect : \"" + conf.effect + "\""; }

                // close other instances?
                if (conf.oneInstance) {
                    $.each(instances, function () {
                        this.close(e);
                    });
                }

                // onBeforeLoad
                e = e || $.Event();
                e.type = "onBeforeLoad";
                fire.trigger(e);
                if (e.isDefaultPrevented()) { return self; }

                // opened
                opened = true;

                // possible mask effect
                if (maskConf) { $(overlay).expose(maskConf); }

                // position & dimensions
                var top = conf.top,
                    left = conf.left,
                    oWidth = overlay.outerWidth(true),
                    oHeight = overlay.outerHeight(true);

                if (typeof top == 'string') {
                    top = top == 'center' ? Math.max((w.height() - oHeight) / 2, 0) :
                        parseInt(top, 10) / 100 * w.height();
                }

                if (left == 'center') { left = Math.max((w.width() - oWidth) / 2, 0); }


                // load effect
                eff[0].call(self, { top: top, left: left }, function () {
                    if (opened) {
                        e.type = "onLoad";
                        fire.trigger(e);
                    }
                });

                // mask.click closes overlay
                if (maskConf && conf.closeOnClick) {
                    $.mask.getMask().one("click", self.close);
                }

                // when window is clicked outside overlay, we close
                if (conf.closeOnClick) {
                    $(document).on("click." + uid, function (e) {
                        if (!$(e.target).parents(overlay).length) {
                            self.close(e);
                        }
                    });
                }

                // keyboard::escape
                if (conf.closeOnEsc) {

                    // one callback is enough if multiple instances are loaded simultaneously
                    $(document).on("keydown." + uid, function (e) {
                        if (e.keyCode == 27) {
                            self.close(e);
                        }
                    });
                }


                return self;
            },

            close: function (e) {

                if (!self.isOpened()) { return self; }

                e = e || $.Event();
                e.type = "onBeforeClose";
                fire.trigger(e);
                if (e.isDefaultPrevented()) { return; }

                opened = false;

                // close effect
                effects[conf.effect][1].call(self, function () {
                    e.type = "onClose";
                    fire.trigger(e);
                });

                // unbind the keyboard / clicking actions
                $(document).off("click." + uid + " keydown." + uid);

                if (maskConf) {
                    $.mask.close();
                }

                return self;
            },

            getOverlay: function () {
                return overlay;
            },

            getTrigger: function () {
                return trigger;
            },

            getClosers: function () {
                return closers;
            },

            isOpened: function () {
                return opened;
            },

            // manipulate start, finish and speeds
            getConf: function () {
                return conf;
            }

        });

        // callbacks
        $.each("onBeforeLoad,onStart,onLoad,onBeforeClose,onClose".split(","), function (i, name) {

            // configuration
            if ($.isFunction(conf[name])) {
                $(self).on(name, conf[name]);
            }

            // API
            self[name] = function (fn) {
                if (fn) { $(self).on(name, fn); }
                return self;
            };
        });

        // close button
        closers = overlay.find(conf.close || ".close");

        if (!closers.length && !conf.close) {
            closers = $('<a class="close"></a>');
            overlay.prepend(closers);
        }

        closers.click(function (e) {
            self.close(e);
        });

        // autoload
        if (conf.load) { self.load(); }

    }

    // jQuery plugin initialization
    $.fn.overlay = function (conf) {

        // already constructed --> return API
        var el = this.data("overlay");
        if (el) { return el; }

        if ($.isFunction(conf)) {
            conf = { onBeforeLoad: conf };
        }

        conf = $.extend(true, {}, $.tools.overlay.conf, conf);

        this.each(function () {
            el = new Overlay($(this), conf);
            instances.push(el);
            $(this).data("overlay", el);
        });

        return conf.api ? el : this;
    };

})(jQuery);
/**
 * @license
 * jQuery Tools @VERSION / Overlay Apple effect.
 *
 * NO COPYRIGHTS OR LICENSES. DO WHAT YOU LIKE.
 *
 * http://flowplayer.org/tools/overlay/apple.html
 *
 * Since: July 2009
 * Date: @DATE
 */
(function($) {

    // version number
    var t = $.tools.overlay,
        w = $(window);

    // extend global configuragion with effect specific defaults
    $.extend(t.conf, {
        start: {
            top: null,
            left: null
        },

        fadeInSpeed: 'fast',
        zIndex: 9999
    });

    // utility function
    function getPosition(el) {
        var p = el.offset();
        return {
            top: p.top + el.height() / 2,
            left: p.left + el.width() / 2
        };
    }

    //{{{ load

    var loadEffect = function(pos, onLoad) {

        var overlay = this.getOverlay(),
            conf = this.getConf(),
            trigger = this.getTrigger(),
            self = this,
            oWidth = overlay.outerWidth(true),
            img = overlay.data("img"),
            position = conf.fixed ? 'fixed' : 'absolute';


        // growing image is required.
        if (!img) {
            var bg = overlay.css("backgroundImage");

            if (!bg) {
                throw "background-image CSS property not set for overlay";
            }

            // url("bg.jpg") --> bg.jpg
            bg = bg.slice(bg.indexOf("(") + 1, bg.indexOf(")")).replace(/\"/g, "");
            overlay.css("backgroundImage", "none");

            img = $('<img src="' + bg + '"/>');
            img.css({border:0, display:'none'}).width(oWidth);
            $('body').append(img);
            overlay.data("img", img);
        }

        // initial top & left
        var itop = conf.start.top || Math.round(w.height() / 2),
            ileft = conf.start.left || Math.round(w.width() / 2);

        if (trigger) {
            var p = getPosition(trigger);
            itop = p.top;
            ileft = p.left;
        }

        // put overlay into final position
        if (conf.fixed) {
            itop -= w.scrollTop();
            ileft -= w.scrollLeft();
        } else {
            pos.top += w.scrollTop();
            pos.left += w.scrollLeft();
        }

        // initialize background image and make it visible
        img.css({
            position: 'absolute',
            top: itop,
            left: ileft,
            width: 0,
            zIndex: conf.zIndex
        }).show();

        pos.position = position;
        overlay.css(pos);

        // begin growing
        img.animate({
            top: pos.top,
            left: pos.left,
            width: oWidth}, conf.speed, function() {

            // set close button and content over the image
            overlay.css("zIndex", conf.zIndex + 1).fadeIn(conf.fadeInSpeed, function()  {

                if (self.isOpened() && !$(this).index(overlay)) {
                    onLoad.call();
                } else {
                    overlay.hide();
                }
            });

        }).css("position", position);

    };
    //}}}


    var closeEffect = function(onClose) {

        // variables
        var overlay = this.getOverlay().hide(),
            conf = this.getConf(),
            trigger = this.getTrigger(),
            img = overlay.data("img"),

            css = {
                top: conf.start.top,
                left: conf.start.left,
                width: 0
            };

        // trigger position
        if (trigger) { $.extend(css, getPosition(trigger)); }


        // change from fixed to absolute position
        if (conf.fixed) {
            img.css({position: 'absolute'})
                .animate({ top: "+=" + w.scrollTop(), left: "+=" + w.scrollLeft()}, 0);
        }

        // shrink image
        img.animate(css, conf.closeSpeed, onClose);
    };


    // add overlay effect
    t.addEffect("apple", loadEffect, closeEffect);

})(jQuery);

/**
 * @license
 * jQuery Tools @VERSION / Expose - Dim the lights
 *
 * NO COPYRIGHTS OR LICENSES. DO WHAT YOU LIKE.
 *
 * http://flowplayer.org/tools/toolbox/expose.html
 *
 * Since: Mar 2010
 * Date: @DATE
 */
(function($) {

    // static constructs
    $.tools = $.tools || {version: '@VERSION'};

    var tool;

    tool = $.tools.expose = {

        conf: {
            maskId: 'exposeMask',
            loadSpeed: 'slow',
            closeSpeed: 'fast',
            closeOnClick: true,
            closeOnEsc: true,

            // css settings
            zIndex: 9998,
            opacity: 0.8,
            startOpacity: 0,
            color: '#fff',

            // callbacks
            onLoad: null,
            onClose: null
        }
    };

    /* one of the greatest headaches in the tool. finally made it */
    function viewport() {

        // the horror case
        if (/msie/.test(navigator.userAgent.toLowerCase())) {

            // if there are no scrollbars then use window.height
            var d = $(document).height(), w = $(window).height();

            return [
                window.innerWidth || 							// ie7+
                document.documentElement.clientWidth || 	// ie6
                document.body.clientWidth, 					// ie6 quirks mode
                d - w < 20 ? w : d
            ];
        }

        // other well behaving browsers
        return [$(document).width(), $(document).height()];
    }

    function call(fn) {
        if (fn) { return fn.call($.mask); }
    }

    var mask, exposed, loaded, config, overlayIndex;


    $.mask = {

        load: function(conf, els) {

            // already loaded ?
            if (loaded) { return this; }

            // configuration
            if (typeof conf == 'string') {
                conf = {color: conf};
            }

            // use latest config
            conf = conf || config;

            config = conf = $.extend($.extend({}, tool.conf), conf);

            // get the mask
            mask = $("#" + conf.maskId);

            // or create it
            if (!mask.length) {
                mask = $('<div/>').attr("id", conf.maskId);
                $("body").append(mask);
            }

            // set position and dimensions
            var size = viewport();

            mask.css({
                position:'absolute',
                top: 0,
                left: 0,
                width: size[0],
                height: size[1],
                display: 'none',
                opacity: conf.startOpacity,
                zIndex: conf.zIndex
            });

            if (conf.color) {
                mask.css("backgroundColor", conf.color);
            }

            // onBeforeLoad
            if (call(conf.onBeforeLoad) === false) {
                return this;
            }

            // esc button
            if (conf.closeOnEsc) {
                $(document).on("keydown.mask", function(e) {
                    if (e.keyCode == 27) {
                        $.mask.close(e);
                    }
                });
            }

            // mask click closes
            if (conf.closeOnClick) {
                mask.on("click.mask", function(e)  {
                    $.mask.close(e);
                });
            }

            // resize mask when window is resized
            $(window).on("resize.mask", function() {
                $.mask.fit();
            });

            // exposed elements
            if (els && els.length) {

                overlayIndex = els.eq(0).css("zIndex");

                // make sure element is positioned absolutely or relatively
                $.each(els, function() {
                    var el = $(this);
                    if (!/relative|absolute|fixed/i.test(el.css("position"))) {
                        el.css("position", "relative");
                    }
                });

                // make elements sit on top of the mask
                exposed = els.css({ zIndex: Math.max(conf.zIndex + 1, overlayIndex == 'auto' ? 0 : overlayIndex)});
            }

            // reveal mask
            mask.css({display: 'block'}).fadeTo(conf.loadSpeed, conf.opacity, function() {
                $.mask.fit();
                call(conf.onLoad);
                loaded = "full";
            });

            loaded = true;
            return this;
        },

        close: function() {
            if (loaded) {

                // onBeforeClose
                if (call(config.onBeforeClose) === false) { return this; }

                mask.fadeOut(config.closeSpeed, function()  {
                    if (exposed) {
                        exposed.css({zIndex: overlayIndex});
                    }
                    loaded = false;
                    call(config.onClose);
                });

                // unbind various event listeners
                $(document).off("keydown.mask");
                mask.off("click.mask");
                $(window).off("resize.mask");
            }

            return this;
        },

        fit: function() {
            if (loaded) {
                var size = viewport();
                mask.css({width: size[0], height: size[1]});
            }
        },

        getMask: function() {
            return mask;
        },

        isLoaded: function(fully) {
            return fully ? loaded == 'full' : loaded;
        },

        getConf: function() {
            return config;
        },

        getExposed: function() {
            return exposed;
        }
    };

    $.fn.mask = function(conf) {
        $.mask.load(conf);
        return this;
    };

    $.fn.expose = function(conf) {
        $.mask.load(conf, this);
        return this;
    };


})(jQuery);
