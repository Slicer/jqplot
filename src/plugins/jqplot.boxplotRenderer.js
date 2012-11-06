(function($) {
    /**
     * Class: $.jqplot.BoxplotRenderer
     * jqPlot Plugin to draw box plots <http://en.wikipedia.org/wiki/Box_plot>.
     * 
     * To use this plugin, include the renderer js file in 
     * your source:
     * 
     * > <script type="text/javascript" src="plugins/jqplot.boxplotRenderer.js"></script>
     * 
     * Then you set the renderer in the series options on your plot:
     * 
     * > series: [{renderer:$.jqplot.BoxplotRenderer}]
     * 
     * Data should be specified like so:
     * 
     * > dat = [[sample_id, min, q1, median, q3, max], ...]
     * 
     * Originally written by Joshua Bronson. https://bitbucket.org/jab/jqplot/changeset/f0f8eaa7e09e
     *
     *
     * JVM - added support for displaying outliers. To represent outliers, 
     * data is extended, e.g.
     *
     * > dat = [[sample_id, min, q1, median, q3, max, out1, out2, out3], ...]
     *
     * Outliers are rendered using the markerRender, which draws shadows
     * for the markers. Markers looked odd as non-filled circles with 
     * shadows, so markers are rendered as filled circles.
     * 
     * Also hacked the init() method so the y-axis bounds are calculated. 
     * Assumes a linear axis. Cache the bounds in the rendererOptions so
     * the bounds can later be passed down to replot.
     *
     * Highlighter highlights the low point, not the median. May change the 
     * ordering to have the median first, or repeat the median so it is in 
     * the y position.
     */
    $.jqplot.BoxplotRenderer = function(){
        // subclass line renderer to make use of some of its methods.
        $.jqplot.LineRenderer.call(this);
        // prop: boxWidth
        // Default will auto calculate based on plot width and number
        // of boxes displayed.
        this.boxWidth = 'auto';
        this._boxMaxWidth = 100; // if 'auto', cap at this max
        // prop: lineWidth
        // The thickness of all lines drawn. Default is 1.5 pixels.
        this.lineWidth = 1.5;
    };
    
    $.jqplot.BoxplotRenderer.prototype = new $.jqplot.LineRenderer();
    $.jqplot.BoxplotRenderer.prototype.constructor = $.jqplot.BoxplotRenderer;
    
    // called with scope of series.
    $.jqplot.BoxplotRenderer.prototype.init = function(options) {
        options = options || {};
        this.lineWidth = options.lineWidth || this.renderer.lineWidth;
        $.jqplot.LineRenderer.prototype.init.call(this, options);
        this._type = 'boxplot';
        // set the yaxis data bounds here to account for high and low values
        var db = this._yaxis._dataBounds;
        var d = this.data;
        for (var j=0; j<d.length; j++) {
            if (d[j][1] < db.min || db.min == null)
                db.min = d[j][1];
            if (d[j][5] > db.max || db.max == null)
                db.max = d[j][5];
            // adjust the bounds for any outliers
            for (i = 6; i < d[j].length; ++i) {
                if (d[j][i] < db.min || db.min == null)
                    db.min = d[j][i];
                if (d[j][i] > db.max || db.max == null)
                    db.max = d[j][i];
            }
        }
        // use the tick generator to guess bounds. assumes a linear y-axis.
        //
        
        // first guess
        var ret = $.jqplot.LinearTickGenerator(db.min, db.max);

        // second guess using padding
        var range = db.max - db.min;
        var padMin = (this._yaxis.pad - 1)/2 + 1;
        var padMax = (this._yaxis.pad - 1)/2 + 1;
        var tumin = db.min + range*(padMin - 1);
        var tumax = db.max - range*(padMax - 1);
        if (db.min <tumin || db.max > tumax) {
            tumin = db.min - range*(padMin - 1);
            tumax = db.max + range*(padMax - 1);
            ret = $.jqplot.LinearTickGenerator(tumin, tumax);
        }

        // stash the y-axis bounds (where?)
        $.extend(true, this.renderer, {replot: {axes: {yaxis: {min: ret[0], max: ret[1]}}}});
        //alert(JSON.stringify(this.renderer, null, 4));
    };

    // called within scope of series.
    $.jqplot.BoxplotRenderer.prototype.draw = function(ctx, gd, options) {
        var d = this.data;
        var r = this.renderer;
        var xp = this._xaxis.series_u2p;
        var yp = this._yaxis.series_u2p;
        if (!options)
            options = {};
        if (!('lineWidth' in options))
            $.extend(true, options, {lineWidth: this.lineWidth});
        var boxopts = $.extend(true, {}, options, {strokeRect: true});
        var boxW = options.boxWidth || r.boxWidth;
        if (boxW == 'auto')
            boxW = Math.min(r._boxMaxWidth, 0.6 * ctx.canvas.width/d.length);
        var endW = boxW / 2; // min and max ticks are half the box width
        boxW -= this.lineWidth*2;
        ctx.save();
        if (this.show) {
            for (var i=0, di=d[i]; i<d.length; di=d[++i]) {
               var  x = xp(di[0]),
                  min = yp(di[1]),
                   q1 = yp(di[2]),
                  med = yp(di[3]),
                   q3 = yp(di[4]),
                  max = yp(di[5]);

                var endL = x - endW/2; // start (left) x coord of min/max ticks
                var endR = x + endW/2; // end (right) x coord of min/max ticks
                var medL = x - boxW/2; // start (left) x coord of median tick
                var medR = x + boxW/2; // end (right) x coord of median tick

                // draw whiskers
                r.shapeRenderer.draw(ctx, [[x, min], [x, q1]], options); 
                r.shapeRenderer.draw(ctx, [[x, q3], [x, max]], options); 

                // draw min and max ticks
                r.shapeRenderer.draw(ctx, [[endL, min], [endR, min]], options);
                r.shapeRenderer.draw(ctx, [[endL, max], [endR, max]], options);
                // median tick is full box width
                r.shapeRenderer.draw(ctx, [[medL, med], [medR, med]], options);

                // draw box
                boxH = q1 - q3;
                boxpoints = [medL, q3, boxW, boxH];
                r.shapeRenderer.draw(ctx, boxpoints, boxopts);

                // draw outliers
                for (var j=6; j < di.length; ++j) {
                    this.markerRenderer.draw(x, yp(di[j]), ctx, {style: 'circle', fill: true}); // can't get shadows to turn off, shadows look wierd if hollow, so fill
                }
            }
        }
        ctx.restore();
    };  
    
    $.jqplot.BoxplotRenderer.prototype.drawShadow = function(ctx, gd, options) {
        // This is a no-op, shadows drawn with lines.
    };
    
    // called with scope of plot.
    $.jqplot.BoxplotRenderer.checkOptions = function(target, data, options) {
        // provide some sensible highlighter options by default
        hldefaults = {
            showMarker: false,
            tooltipAxes: 'y',
            yvalues: 5,
            formatString: '<table class="jqplot-highlighter">' +
                          '<tr><td>min:</td><td>%s</td></tr>' +
                          '<tr><td>q1:</td><td>%s</td></tr>' +
                          '<tr><td>med:</td><td>%s</td></tr>' +
                          '<tr><td>q3:</td><td>%s</td></tr>' +
                          '<tr><td>max:</td><td>%s</td></tr>' +
                          '</table>'
            };
        if (!options.highlighter)
            options.highlighter = {show: true};
        if (options.highlighter.show) {
            for (opt in hldefaults) {
                if (!(opt in options.highlighter)) {
                    options.highlighter[opt] = hldefaults[opt];
                }
            }
        }
    };
    
    $.jqplot.preInitHooks.push($.jqplot.BoxplotRenderer.checkOptions);

    
})(jQuery);