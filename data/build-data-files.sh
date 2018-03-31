#!/usr/bin/env bash
# inspired by https://medium.com/@mbostock/command-line-cartography-part-1-897aa8f8ca2c
# requires:
# npm install -g shapefile
# npm install -g d3-geo-projection
# npm install -g ndjson-cli

source ../.env

# download the county-level shape file from census.gov
if [ ! -e cb_2016_us_county_20m.zip ]; then
    curl 'https://www2.census.gov/geo/tiger/GENZ2016/shp/cb_2016_us_county_20m.zip' -o cb_2016_us_county_20m.zip
fi
unzip -o cb_2016_us_county_20m.zip -d temp

# convert the shape file to geojson
shp2json temp/cb_2016_us_county_20m.shp -o temp/cb_2016_us_county_20m.geo.json

# pre-project the geojson using geoAlbersUsa for better rendering performance
geoproject 'd3.geoAlbersUsa()' < temp/cb_2016_us_county_20m.geo.json > temp/cb_2016_us_county_20m-albers.geo.json

# use ndjson to set an id property on each county
ndjson-split 'd.features' \
  < temp/cb_2016_us_county_20m-albers.geo.json \
  > temp/cb_2016_us_county_20m-albers.geo.ndjson
ndjson-map 'd.id = d.properties.GEOID, d' \
  < temp/cb_2016_us_county_20m-albers.geo.ndjson \
  > temp/cb_2016_us_county_20m-albers.id.geo.ndjson

# download the population estimates for each county
if [ ! -e 2016_us_county_pop.json ]; then
    curl "https://api.census.gov/data/2016/pep/population?get=POP,GEONAME&for=county:*&DATE=9&key=${CENSUS_GOV_API_KEY}" \
      -o 2016_us_county_pop.json
fi

# convert json from arrays into objects
ndjson-cat 2016_us_county_pop.json \
  | ndjson-split 'd.slice(1)' \
  | ndjson-map '{id: d[3] + d[4], county: d[1], pop2016: +d[0]}' \
  > temp/2016_us_county_pop.ndjson

# join the population data into the geojson
ndjson-join 'd.id' \
  temp/cb_2016_us_county_20m-albers.id.geo.ndjson \
  temp/2016_us_county_pop.ndjson \
  > temp/cb_2016_us_county_20m-albers-join.ndjson

# consolidate the properties for each county into a single properties object
ndjson-map 'd[0].properties = {county: d[1].county, pop2016: d[1].pop2016}, d[0]' \
  < temp/cb_2016_us_county_20m-albers-join.ndjson \
  > temp/cb_2016_us_county_20m-albers-pop.ndjson

# convert the ndjson back to geojson
ndjson-reduce 'p.features.push(d), p' '{type: "FeatureCollection", features: []}' \
  < temp/cb_2016_us_county_20m-albers-pop.ndjson \
  > temp/cb_2016_us_county_20m-albers-pop.geo.json

# copy the geojson into the assets folder so that it can be visualized
cp temp/cb_2016_us_county_20m-albers-pop.geo.json ../src/assets/cb_2016_us_county_20m-albers-pop.geo.json
