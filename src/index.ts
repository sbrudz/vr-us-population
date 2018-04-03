import "aframe-geo-projection-component";
import "./legend";
import { extent } from "d3-array";
import { scaleLinear, scaleThreshold } from "d3-scale";
import { csv } from "d3-fetch";
import { schemePiYG } from "d3-scale-chromatic";

const THREE = AFRAME.THREE;
const MAX_YEAR = 2016;

interface IPopDataRecord {
    id: string,
    county: string,
    popestimate2010: number,
    popestimate2011: number,
    popestimate2012: number,
    popestimate2013: number,
    popestimate2014: number,
    popestimate2015: number,
    popestimate2016: number,
    npopchg2010: number,
    npopchg2011: number,
    npopchg2012: number,
    npopchg2013: number,
    npopchg2014: number,
    npopchg2015: number,
    npopchg2016: number
}

const processPopDataFile = (d) : IPopDataRecord => {
    return {
        id: d.id,
        county: d.county,
        popestimate2010: +d.popestimate2010,
        popestimate2011: +d.popestimate2011,
        popestimate2012: +d.popestimate2012,
        popestimate2013: +d.popestimate2013,
        popestimate2014: +d.popestimate2014,
        popestimate2015: +d.popestimate2015,
        popestimate2016: +d.popestimate2016,
        npopchg2010: (+d.popestimate2010 - +d.estimatesbase2010)/+d.popestimate2010,
        npopchg2011: (+d.popestimate2011 - +d.popestimate2010)/+d.popestimate2011,
        npopchg2012: (+d.popestimate2012 - +d.popestimate2011)/+d.popestimate2012,
        npopchg2013: (+d.popestimate2013 - +d.popestimate2012)/+d.popestimate2013,
        npopchg2014: (+d.popestimate2014 - +d.popestimate2013)/+d.popestimate2014,
        npopchg2015: (+d.popestimate2015 - +d.popestimate2014)/+d.popestimate2015,
        npopchg2016: (+d.popestimate2016 - +d.popestimate2015)/+d.popestimate2016
    };
};

const getPopColumnNameForYear = (year) => `popestimate${year}`;
const getPopDeltaColumnNameForYear = (year) => `npopchg${year}`;

const calculateMinMaxExtent = (data: Array<IPopDataRecord>, accessor: (year: number) => string) : Array<number> => {
    const extentsForAllYears = [];
    for (let year = 2010; year <= MAX_YEAR; year++) {
        const columnName = accessor(year);
        const extentForYear = extent(data, (d) => d[columnName]);
        extentsForAllYears.push(extentForYear[0], extentForYear[1]);
    }
    return extent(extentsForAllYears);
};

AFRAME.registerComponent('extrude-by-population', {
    dependencies: ['geo-projection'],
    schema: {
        year: {
            default: '2011'
        },
        maxExtrudeHeight: {
            default: 2
        }
    },
    init: function () {
        this.geoProjectionComponent = this.el.components['geo-projection'];
        this.ready = false;

        const csvLoaderPromise = csv('assets/2016_us_county_pop.csv', processPopDataFile).then((data: Array<IPopDataRecord>) => {
            this.populationData = data.reduce((accum, d) => {
                accum[d.id] = d;
                return accum;
            }, {});

            this.minMaxPopExtent = calculateMinMaxExtent(data, getPopColumnNameForYear);

            const [minPopDelta, maxPopDelta] = calculateMinMaxExtent(data, getPopDeltaColumnNameForYear);
            const thresholds = [-0.10, -0.03, 0.03, 0.10];
            this.colorScale = scaleThreshold<number, string>().domain(thresholds).range(schemePiYG[5]);
            const allThresholds = [minPopDelta, ...thresholds, maxPopDelta];
            this.el.emit('set-legend-color-scale', { colorScale: this.colorScale, thresholds: allThresholds }, true);

        }, (error) => { console.error(error); });

        const geoDataLoaderPromise = new Promise((resolve => {
            this.el.addEventListener('geo-src-loaded', resolve);
        }));

        // Wait until all files to finish loading to avoid race conditions
        Promise.all([geoDataLoaderPromise, csvLoaderPromise]).then(() => {
            this.ready = true;
            this.render();
        }, (error) => { console.error(error); });
    },
    update: function (oldData) {
        if (!this.ready) {
            return;
        }
        if (this.data.maxExtrudeHeight !== oldData.maxExtrudeHeight || this.data.year !== oldData.year) {
            this.render();
        }
    },
    render: function () {
        const popColumnName = getPopColumnNameForYear(this.data.year);
        const popDeltaColumnName = getPopDeltaColumnNameForYear(this.data.year);

        const extrudeScale = scaleLinear().domain(this.minMaxPopExtent).range([0, this.data.maxExtrudeHeight]);

        this.el.emit('update-legend-year', { year: this.data.year }, true);

        // Split the geoJson into features and render each one individually so that we can set a different
        // extrusion height for each based on the population.
        const features = this.geoProjectionComponent.geoJson.features;
        let extrudeGeometries = {};
        let outlineVertices = [];
        features.forEach((feature) => {
            const population = this.populationData[feature.id][popColumnName];
            const populationDelta = this.populationData[feature.id][popDeltaColumnName];
            const color = this.colorScale(populationDelta);
            const extrudeAmount = extrudeScale(population);
            const extrudeSettings = {
                amount: extrudeAmount,
                bevelEnabled: false
            };

            const mapRenderContext = this.geoProjectionComponent.renderer.renderToContext(feature, this.geoProjectionComponent.projection);
            let countyShapes = mapRenderContext.toShapes(this.geoProjectionComponent.data.isCCW);

            if (countyShapes.find(s => s.getPoints().length <= 3)) {
                // ensure all shapes have at least 3 unique points
                countyShapes = countyShapes
                    .map(s => new Set(s.getPoints().map(JSON.stringify)).size)
                    .filter(p => p >= 3);
                if (countyShapes.length <= 0) {
                    console.warn(`Skipping county with id ${feature.id} because it is too small to triangulate`);
                    return;
                }
            }
            // Gather the outline of the county and set the height of the outline to the extrude level
            // so that the top of the county is outlined
            outlineVertices = outlineVertices.concat(mapRenderContext.toVertices(extrudeAmount));

            // Merge all the extruded feature geometries together for better rendering performance
            // Need to use ExtrudeGeometry here instead of ExtrudeBufferGeometry because the latter doesn't merge properly
            // in this version of Three.js
            const extrudedFeatureGeometry = new THREE.ExtrudeGeometry(countyShapes, extrudeSettings);
            if (!extrudeGeometries[color]) {
                extrudeGeometries[color] = extrudedFeatureGeometry;
            } else {
                extrudeGeometries[color].merge(extrudedFeatureGeometry);
            }
        });

        for (const color in extrudeGeometries) {
            const extrudeGeometry = extrudeGeometries[color];

            const material = new THREE.MeshLambertMaterial({ color });
            // const sideMaterial = new THREE.MeshBasicMaterial({color: 0xb3763e});
            const extrudedMap = new THREE.Mesh(extrudeGeometry, material);
            this.el.setObject3D(color, extrudedMap);
        }

        const outlineGeometry = new THREE.BufferGeometry();
        outlineGeometry.addAttribute('position', new THREE.Float32BufferAttribute(outlineVertices, 3));
        const outlineMaterial = new THREE.LineBasicMaterial( { color: 0xa40000 } );
        const outlineObject3D = new THREE.LineSegments(outlineGeometry, outlineMaterial);
        this.el.setObject3D('lines', outlineObject3D);
    }
});
