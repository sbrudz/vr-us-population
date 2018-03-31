import "aframe-geo-projection-component";
import { max } from "d3-array";
import { csv } from "d3-fetch";

const THREE = AFRAME.THREE;

const processPopDataFile = (d) => {
    return {
        summaryLevel: d.sumlev,
        region: d.region,
        division: d.division,
        state: d.state,
        county: d.county,
        stateName: d.stname,
        countyName: d.ctyname,
        census2010pop: +d.census2010pop,
        estimatesbase2010: +d.estimatesbase2010,
        popestimate2010: +d.popestimate2010,
        popestimate2011: +d.popestimate2011,
        popestimate2012: +d.popestimate2012,
        popestimate2013: +d.popestimate2013,
        popestimate2014: +d.popestimate2014,
        popestimate2015: +d.popestimate2015,
        popestimate2016: +d.popestimate2016,
        npopchg_2010: +d.npopchg_2010,
        npopchg_2011: +d.npopchg_2011,
        npopchg_2012: +d.npopchg_2012,
        npopchg_2013: +d.npopchg_2013,
        npopchg_2014: +d.npopchg_2014,
        npopchg_2015: +d.npopchg_2015,
        npopchg_2016: +d.npopchg_2016
    };
};


AFRAME.registerComponent('data-for-map', {
    dependencies: ['geo-projection'],
    schema: {
        year: {
            default: '2010'
        },
        maxExtrudeHeight: {
            default: 3
        }
    },
    init: function () {
        this.geoProjectionComponent = this.el.components['geo-projection'];

        // Wait for geoJson to finish loading to avoid race conditions
        this.el.addEventListener('geo-src-loaded', this.geoJsonReady.bind(this));
    },
    update: function (oldData) {
        if (this.data.maxExtrudeHeight !== oldData.maxExtrudeHeight) {
            // this.geoJsonReady();
        }
    },
    geoJsonReady: async function () {
        // Override the render method of geoProjectionComponent with the custom one on this component
        // this allows us to push the data that needs to be visualized into the rendering pipeline
        this.geoProjectionComponent.render = this.render;

        // Now kick off loading the data
        const populationData = await csv('./assets/us-pop-2010-2016.csv', processPopDataFile);
        this.onDataLoaded(populationData);
    },
    onDataLoaded: function(populationData) {
        const popColumnName = `popestimate${this.data.year}`;
        const deltaPopColumnName = `npopchg_${this.data.year}`;
        const maxPopulation = max(populationData, function (d) {
            return d[popColumnName];
        });
        const populationByGeoId = populationData.reduce(function (accum, d) {
            const fipsForCounty = `0500000US${d.state}${d.county}`;
            accum[fipsForCounty] = d;
            return accum;
        }, {});
        this.geoProjectionComponent.render(populationByGeoId, maxPopulation, this.data.maxExtrudeHeight,
            popColumnName, deltaPopColumnName);
    },
    // Custom rendering function that does all the work
    // Note that the `this` for this function is the geoProjectionComponent instead of this data-for-map component
    // So that we can use all the functions and data of the geoProjectionComponent to help with rendering
    render: function (populationByGeoId, maxPopulation, maxExtrudeHeight, popColumnName, deltaPopColumnName) {
        if (!populationByGeoId) return;
        const material = this.el.components.material.material;
        let extrudeGeometry = null;
        let outlineVertices = [];
        // Split the geoJson into features and render each one individually so that we can set a different
        // extrusion height for each based on the population.
        this.geoJson.features.forEach(function (feature) {
            if (feature.properties.STATE === '72') {
                return; // skip puerto rico
            }
            const geoId = feature.properties.GEO_ID;
            let populationData = populationByGeoId[geoId];
            if (!populationData) {
                console.warn(`County ${feature.properties.NAME} in state ${feature.properties.STATE} (${geoId}) has no associated population data`);
                return;
            }
            const population = populationData[popColumnName];
            const extrudeAmount = (population / maxPopulation) * maxExtrudeHeight;
            const extrudeSettings = {
                amount: extrudeAmount,
                bevelEnabled: false
            };

            const mapRenderContext = this.renderer.renderToContext(feature, this.projection);
            const countyShapes = mapRenderContext.toShapes(this.data.isCCW);

            // Gather the outline of the county and set the height of the outline to the extrude level
            // so that the top of the state is outlined
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
        }.bind(this));

        // Convert the extrude geometry into a buffer geometry for better rendering performance
        const extrudeBufferGeometry = new THREE.BufferGeometry();
        extrudeBufferGeometry.fromGeometry(extrudeGeometry);

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
