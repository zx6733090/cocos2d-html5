/****************************************************************************
 Copyright (c) 2010-2012 cocos2d-x.org
 Copyright (c) 2008-2010 Ricardo Quesada
 Copyright (c) 2011      Zynga Inc.

 http://www.cocos2d-x.org

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

/**
 * Singleton that handles the loading of the sprite frames. It saves in a cache the sprite frames.
 * @class
 * @extends cc.Class
 * @example
 * // add SpriteFrames to SpriteFrameCache With File
 * cc.SpriteFrameCache.getInstance().addSpriteFrames(s_grossiniPlist);
 */
cc.SpriteFrameCache = cc.Class.extend(/** @lends cc.SpriteFrameCache# */{
    _spriteFrames: null,
    _spriteFramesAliases: null,

    _frameConfigCache : null,

    /**
     * Constructor
     */
    ctor: function () {
        this._spriteFrames = {};
        this._spriteFramesAliases = {};
        this._frameConfigCache = {};
    },


    /**
     * Get the real data structure of frame used by engine.
     * @param url
     * @returns {*}
     * @private
     */
    _getFrameConfig : function(url){
        var dict = cc.loader.getRes(url);
        if(!dict) throw "Please load the resource first : " + url;
        cc.loader.release(url);//release it in loader
        if(dict._inited){
            this._frameConfigCache[url] = dict;
            return dict;
        }
        var tempFrames = dict["frames"], tempMeta = dict["metadata"] || dict["meta"];
        var frames = {}, meta = {};
        var format = 0;
        if(tempMeta){//init meta
            var tmpFormat = tempMeta["format"];
            format = (tmpFormat.length <= 1) ? parseInt(tmpFormat) : tmpFormat;
            meta.image = tempMeta["textureFileName"] || tempMeta["textureFileName"] || tempMeta["image"];
        }
        for (var key in tempFrames) {
            var frameDict = tempFrames[key];
            if(!frameDict) continue;
            var tempFrame = {};

            if (format == 0) {
                tempFrame.rect = cc.rect(frameDict["x"], frameDict["y"], frameDict["width"], frameDict["height"]);
                tempFrame.rotated = false;
                tempFrame.offset = cc.p(frameDict["offsetX"], frameDict["offsetY"]);
                var ow = frameDict["originalWidth"];
                var oh = frameDict["originalHeight"];
                // check ow/oh
                if (!ow || !oh) {
                    cc.log("cocos2d: WARNING: originalWidth/Height not found on the cc.SpriteFrame. AnchorPoint won't work as expected. Regenrate the .plist");
                }
                // Math.abs ow/oh
                ow = Math.abs(ow);
                oh = Math.abs(oh);
                tempFrame.size = cc.size(ow, oh);
            } else if (format == 1 || format == 2) {
                tempFrame.rect = cc.RectFromString(frameDict["frame"]);
                tempFrame.rotated = frameDict["rotated"] || false;
                tempFrame.offset = cc.PointFromString(frameDict["offset"]);
                tempFrame.size = cc.SizeFromString(frameDict["sourceSize"]);
            } else if (format == 3) {
                // get values
                var spriteSize = cc.SizeFromString(frameDict["spriteSize"]);
                var textureRect = cc.RectFromString(frameDict["textureRect"]);
                if (spriteSize) {
                    textureRect = cc.rect(textureRect.x, textureRect.y, spriteSize.width, spriteSize.height);
                }
                tempFrame.rect = textureRect;
                tempFrame.rotated = frameDict["textureRotated"] || false; // == "true";
                tempFrame.offset = cc.PointFromString(frameDict["spriteOffset"]);
                tempFrame.size = cc.SizeFromString(frameDict["spriteSourceSize"]);
                tempFrame.aliases = frameDict["aliases"];
            } else {
                var tmpFrame = frameDict["frame"], tmpSourceSize = frameDict["sourceSize"];
                key = frameDict["filename"] || key;
                tempFrame.rect = cc.rect(tmpFrame["x"], tmpFrame["y"], tmpFrame["w"], tmpFrame["h"]);
                tempFrame.rotated = frameDict["rotated"] || false;
                tempFrame.offset = cc.p(0, 0);
                tempFrame.size = cc.size(tmpSourceSize["w"], tmpSourceSize["h"]);
            }
            frames[key] = tempFrame;
        }
        var cfg = this._frameConfigCache[url] = {
            _inited : true,
            frames : frames,
            meta : meta
        };
        return cfg;
    },

    /**
     * <p>
     *   Adds multiple Sprite Frames from a plist or json file.<br/>
     *   A texture will be loaded automatically. The texture name will composed by replacing the .plist or .json suffix with .png<br/>
     *   If you want to use another texture, you should use the addSpriteFrames:texture method.<br/>
     * </p>
     * @param {String} url file path
     * @param {HTMLImageElement|cc.Texture2D|string} texture
     * @example
     * // add SpriteFrames to SpriteFrameCache With File
     * cc.SpriteFrameCache.getInstance().addSpriteFrames(s_grossiniPlist);
     * cc.SpriteFrameCache.getInstance().addSpriteFrames(s_grossiniJson);
     */
    addSpriteFrames: function (url, texture) {
        if (!url)
            throw "cc.SpriteFrameCache.addSpriteFrames(): plist should be non-null";

        var self = this;
        var frameConfig = self._frameConfigCache[url] || self._getFrameConfig(url);
        self._checkConflict(frameConfig);
        var frames = frameConfig.frames, meta = frameConfig.meta;
        if(!texture){
            var texturePath = cc.path.changeBasename(url, meta.image || ".png");
            texture = cc.TextureCache.getInstance().addImage(texturePath);
        }else if(texture instanceof cc.Texture2D){
            //do nothing
        }else if(typeof texture == "string"){//string
            texture = cc.TextureCache.getInstance().addImage(texture);
        }else throw "Argument must be non-nil"

        //create sprite frames
        var spAliases = self._spriteFramesAliases, spriteFrames = self._spriteFrames;
        for (var key in frames) {
            var frame = frames[key];
            var spriteFrame = spriteFrames[key];
            if (!spriteFrame) {
                spriteFrame = cc.SpriteFrame.create(texture, frame.rect, frame.rotated, frame.offset, frame.size);
                var aliases = frame.aliases;
                if(aliases){//set aliases
                    for(var i = 0, li = aliases.length; i < li; i++){
                        var alias = aliases[i];
                        if (spAliases[alias]) {
                            cc.log("cocos2d: WARNING: an alias with name " + alias + " already exists");
                        }
                        spAliases[alias] = key;
                    }
                }
                if (cc.renderContextType === cc.CANVAS && spriteFrame.isRotated()) {
                    //clip to canvas
                    var locTexture = spriteFrame.getTexture();
                    if (locTexture.isLoaded()) {
                        var tempElement = spriteFrame.getTexture().getHtmlElementObj();
                        tempElement = cc.cutRotateImageToCanvas(tempElement, spriteFrame.getRectInPixels());
                        var tempTexture = new cc.Texture2D();
                        tempTexture.initWithElement(tempElement);
                        tempTexture.handleLoadedTexture();
                        spriteFrame.setTexture(tempTexture);

                        var rect = spriteFrame._rect;
                        spriteFrame.setRect(cc.rect(0, 0, rect.width, rect.height));
                    }
                }
                spriteFrames[key] = spriteFrame;
            }
        }
    },

    // Function to check if frames to add exists already, if so there may be name conflit that must be solved
    _checkConflict: function (dictionary) {
        var framesDict = dictionary["frames"];

        for (var key in framesDict) {
            if (this._spriteFrames[key]) {
                cc.log("cocos2d: WARNING: Sprite frame: "+key+" has already been added by another source, please fix name conflit");
            }
        }
    },

    /**
     * <p>
     *  Adds an sprite frame with a given name.<br/>
     *  If the name already exists, then the contents of the old name will be replaced with the new one.
     * </p>
     * @param {cc.SpriteFrame} frame
     * @param {String} frameName
     */
    addSpriteFrame: function (frame, frameName) {
        this._spriteFrames[frameName] = frame;
    },

    /**
     * <p>
     *   Purges the dictionary of loaded sprite frames.<br/>
     *   Call this method if you receive the "Memory Warning".<br/>
     *   In the short term: it will free some resources preventing your app from being killed.<br/>
     *   In the medium term: it will allocate more resources.<br/>
     *   In the long term: it will be the same.<br/>
     * </p>
     */
    removeSpriteFrames: function () {
        this._spriteFrames = {};
        this._spriteFramesAliases = {};
    },

    /**
     * Deletes an sprite frame from the sprite frame cache.
     * @param {String} name
     */
    removeSpriteFrameByName: function (name) {
        // explicit nil handling
        if (!name) {
            return;
        }

        // Is this an alias ?
        if (this._spriteFramesAliases[name]) {
            delete(this._spriteFramesAliases[name]);
        }
        if (this._spriteFrames[name]) {
            delete(this._spriteFrames[name]);
        }
        // XXX. Since we don't know the .plist file that originated the frame, we must remove all .plist from the cache
    },

    /**
     * <p>
     *     Removes multiple Sprite Frames from a plist file.<br/>
     *     Sprite Frames stored in this file will be removed.<br/>
     *     It is convinient to call this method when a specific texture needs to be removed.<br/>
     * </p>
     * @param {String} url plist filename
     */
    removeSpriteFramesFromFile: function (url) {
        var self = this, spriteFrames = self._spriteFrames,
            aliases = self._spriteFramesAliases, cfg = self._frameConfigCache[url];
        if(!cfg) return;
        var frames = cfg.frames;
        for (var key in frames) {
            if (spriteFrames[key]) {
                delete(spriteFrames[key]);
                for (var alias in aliases) {//remove alias
                    if(aliases[alias] == key) delete aliases[alias];
                }
            }
        }
    },

    /**
     * <p>
     *    Removes all Sprite Frames associated with the specified textures.<br/>
     *    It is convinient to call this method when a specific texture needs to be removed.
     * </p>
     * @param {HTMLImageElement|HTMLCanvasElement|cc.Texture2D} texture
     */
    removeSpriteFramesFromTexture: function (texture) {
        var self = this, spriteFrames = self._spriteFrames, aliases = self._spriteFramesAliases;
        for (var key in spriteFrames) {
            var frame = spriteFrames[key];
            if (frame && (frame.getTexture() == texture)) {
                delete(spriteFrames[key]);
                for (var alias in aliases) {//remove alias
                    if(aliases[alias] == key) delete aliases[alias];
                }
            }
        }
    },

    /**
     * <p>
     *   Returns an Sprite Frame that was previously added.<br/>
     *   If the name is not found it will return nil.<br/>
     *   You should retain the returned copy if you are going to use it.<br/>
     * </p>
     * @param {String} name name of SpriteFrame
     * @return {cc.SpriteFrame}
     * @example
     * //get a SpriteFrame by name
     * var frame = cc.SpriteFrameCache.getInstance().getSpriteFrame("grossini_dance_01.png");
     */
    getSpriteFrame: function (name) {
        var self = this, frame = self._spriteFrames[name];
        if (!frame) {
            // try alias dictionary
            var key = self._spriteFramesAliases[name];
            if (key) {
                frame = self._spriteFrames[key.toString()];
                if(!frame) delete self._spriteFramesAliases[name];
            }
        }
        if (!frame) cc.log("cocos2d: cc.SpriteFrameCahce: Frame " + name + " not found");
        return frame;
    }
});

cc.s_sharedSpriteFrameCache = null;

/**
 * Returns the shared instance of the Sprite Frame cache
 * @return {cc.SpriteFrameCache}
 */
cc.SpriteFrameCache.getInstance = function () {
    if (!cc.s_sharedSpriteFrameCache) {
        cc.s_sharedSpriteFrameCache = new cc.SpriteFrameCache();
    }
    return cc.s_sharedSpriteFrameCache;
};

/**
 * Purges the cache. It releases all the Sprite Frames and the retained instance.
 */
cc.SpriteFrameCache.purgeSharedSpriteFrameCache = function () {
    cc.s_sharedSpriteFrameCache = null;
};
