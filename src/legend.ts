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
        const quantiles = event.detail.colorScale.quantiles();
        const {minVal, maxVal} = event.detail.colorScale.domain();
        const colors = event.detail.colorScale.range();

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
        header.setAttribute('value', 'Percentage population change from previous year');
        this.el.appendChild(header);
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
            label.setAttribute('position', `0 ${labelYPos} 0`);
            label.setAttribute('align', 'center');
            label.setAttribute('scale', '0.6 0.6 0.6');
            label.setAttribute('value', '12% to 14%');
            parent.appendChild(label);
            this.el.appendChild(parent);
            currXPosition += width;
        }
    }
});