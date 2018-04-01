import "aframe-geo-projection-component";
import { extent } from "d3-array";
import { scaleLinear } from "d3-scale";
import { csv } from "d3-fetch";

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
        npopchg2010: +d.popestimate2010 - +d.estimatesbase2010,
        npopchg2011: +d.popestimate2011 - +d.popestimate2010,
        npopchg2012: +d.popestimate2012 - +d.popestimate2011,
        npopchg2013: +d.popestimate2013 - +d.popestimate2012,
        npopchg2014: +d.popestimate2014 - +d.popestimate2013,
        npopchg2015: +d.popestimate2015 - +d.popestimate2014,
        npopchg2016: +d.popestimate2016 - +d.popestimate2015
    };
};

const getPopColumnNameForYear = (year) => `popestimate${year}`;

const calculateMinMaxPopExtent = (data: Array<IPopDataRecord>) : Array<number> => {
    const extentsForAllYears = [];
    for (let year = 2010; year <= MAX_YEAR; year++) {
        const popColumnName = getPopColumnNameForYear(year);
        const extentForYear = extent(data, (d) => d[popColumnName]);
        extentsForAllYears.push(extentForYear[0], extentForYear[1]);
    }
    return extent(extentsForAllYears);
};

AFRAME.registerComponent('extrude-by-population', {
    dependencies: ['geo-projection'],
    schema: {
        year: {
            default: '2010'
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
            this.minMaxPopExtent = calculateMinMaxPopExtent(data);
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
        let extrudeGeometry = null;
        let outlineVertices = [];
        // Split the geoJson into features and render each one individually so that we can set a different
        // extrusion height for each based on the population.
        const features = this.geoProjectionComponent.geoJson.features;
        const popColumnName = getPopColumnNameForYear(this.data.year);
        const extrudeScale = scaleLinear().domain(this.minMaxPopExtent).range([0, this.data.maxExtrudeHeight]);
        features.forEach((feature) => {
            const population = this.populationData[feature.id][popColumnName];
            const extrudeAmount = extrudeScale(population);
            const extrudeSettings = {
                amount: extrudeAmount,
                bevelEnabled: false
            };

            const mapRenderContext = this.geoProjectionComponent.renderer.renderToContext(feature, this.geoProjectionComponent.projection);
            const countyShapes = mapRenderContext.toShapes(this.data.isCCW);

            // Gather the outline of the county and set the height of the outline to the extrude level
            // so that the top of the county is outlined
            outlineVertices = outlineVertices.concat(mapRenderContext.toVertices(extrudeAmount));

            // Merge all the extruded feature geometries together for better rendering performance
            // Need to use ExtrudeGeometry here instead of ExtrudeBufferGeometry because the latter doesn't merge properly
            // in this version of Three.js
            const extrudedFeatureGeometry = new THREE.ExtrudeGeometry(countyShapes, extrudeSettings);
            if (!extrudeGeometry) {
                extrudeGeometry = extrudedFeatureGeometry;
            } else {
                extrudeGeometry.merge(extrudedFeatureGeometry);
            }
        });

        // Convert the extrude geometry into a buffer geometry for better rendering performance
        const extrudeBufferGeometry = new THREE.BufferGeometry();
        extrudeBufferGeometry.fromGeometry(extrudeGeometry);

        const material = this.el.components.material.material;
        const sideMaterial = new THREE.MeshStandardMaterial( { color: 0xb3763e } );
        const extrudedMap = new THREE.Mesh(extrudeBufferGeometry, [material, sideMaterial]);
        this.el.setObject3D('map', extrudedMap);

        const outlineGeometry = new THREE.BufferGeometry();
        outlineGeometry.addAttribute('position', new THREE.Float32BufferAttribute(outlineVertices, 3));
        const outlineMaterial = new THREE.LineBasicMaterial( { color: 0xa40000 } );
        const outlineObject3D = new THREE.LineSegments(outlineGeometry, outlineMaterial);
        this.el.setObject3D('lines', outlineObject3D);
    }
});
