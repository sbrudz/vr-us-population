import "aframe-geo-projection-component";
import { extent } from "d3-array";
import { scaleLinear } from "d3-scale";

const THREE = AFRAME.THREE;


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

        // Wait for geoJson to finish loading to avoid race conditions
        this.el.addEventListener('geo-src-loaded', this.geoJsonReady.bind(this));
    },
    update: function (oldData) {
        if (!this.geoProjectionComponent.geoJson) {
            return;
        }
        if (this.data.maxExtrudeHeight !== oldData.maxExtrudeHeight || this.data.year !== oldData.year) {
            this.geoJsonReady();
        }
    },
    geoJsonReady: function () {
        const material = this.el.components.material.material;
        let extrudeGeometry = null;
        let outlineVertices = [];
        // Split the geoJson into features and render each one individually so that we can set a different
        // extrusion height for each based on the population.
        const features = this.geoProjectionComponent.geoJson.features;
        const popColumnName = `popestimate${this.data.year}`;
        // TODO: this should be the min/max for all years so heights have consistent meanings
        const popDomain = extent(features, (d:any) => (+d.properties[popColumnName]));
        const extrudeScale = scaleLinear().domain(popDomain).range([0, this.data.maxExtrudeHeight]);
        features.forEach(function (feature) {
            const population = feature.properties[popColumnName];
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
