import { format } from 'd3-format';
import { pairs } from 'd3-array';
import Entity = AFrame.Entity;

AFRAME.registerComponent('legend', {
    init: function () {
        this.el.sceneEl.addEventListener('set-legend-color-scale', this.createLegendColorScale.bind(this));
        this.el.sceneEl.addEventListener('update-legend-year', this.updateLegendYear.bind(this));
    },
    remove: function () {
        this.el.sceneEl.removeEventListener('set-legend-color-scale', this.createLegendColorScale.bind(this));
        this.el.sceneEl.removeEventListener('update-legend-year', this.updateLegendYear.bind(this));
    },
    updateLegendYear: function (event) {
        const yearEl = document.querySelector('#year');
        yearEl.setAttribute('value', event.detail.year);
    },
    createLegendColorScale: function (event) {
        const colorScale = event.detail.colorScale;
        const thresholds = event.detail.thresholds;
        const thresholdsPerColor = pairs<number>(thresholds).reduce((acc, curr: Array<number>) => {
            const midPoint = (curr[1] + curr[0])/2;
            const color = colorScale(midPoint);
            acc[color] = curr;
            return acc;
        }, {});
        const colors = colorScale.range();

        const containerWidth = Number.parseInt(this.el.getAttribute('width'));
        const containerHeight = Number.parseInt(this.el.getAttribute('height'));
        const width = containerWidth/colors.length;
        let currXPosition = -(containerWidth/2 - width/2);
        const parentHeight = containerHeight/2;
        const boxYPos = parentHeight/4;
        const labelYPos = -(parentHeight/4);
        const header = document.createElement('a-text') as Entity;
        header.setAttribute('align', 'center');
        header.setAttribute('scale', '0.7 0.7 0.7');
        header.setAttribute('position', `0 0 0.01`);
        header.setAttribute('value', 'Percentage population change from 2010');
        this.el.appendChild(header);

        const formatter = format(".0%");
        for (let color of colors) {
            const parent = document.createElement('a-entity') as Entity;
            parent.setAttribute('geometry', {primitive: 'plane', width: width, height: parentHeight});
            parent.setAttribute('position', `${currXPosition} ${-containerHeight/4} 0`);
            parent.setAttribute('material', 'visible', false);
            const box = document.createElement('a-box') as Entity;
            box.setAttribute('position', `0 ${boxYPos} 0`);
            box.setAttribute('material', 'color', color);
            box.setAttribute('height', '0.3');
            box.setAttribute('width', `${width}`);
            box.setAttribute('depth', '0.1');
            parent.appendChild(box);
            const label = document.createElement('a-text') as Entity;
            label.setAttribute('position', `0 ${labelYPos} 0.01`);
            label.setAttribute('align', 'center');
            label.setAttribute('scale', '0.6 0.6 0.6');
            const colorThreshold = thresholdsPerColor[color];
            label.setAttribute('value', `${formatter(colorThreshold[0])}\nto\n${formatter(colorThreshold[1])}`);
            parent.appendChild(label);
            this.el.appendChild(parent);
            currXPosition += width;
        }
    }
});
