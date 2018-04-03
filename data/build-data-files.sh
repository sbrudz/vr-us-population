#!/usr/bin/env bash
# inspired by https://medium.com/@mbostock/command-line-cartography-part-1-897aa8f8ca2c
# requires:
# npm install -g shapefile
# npm install -g d3-geo-projection
# npm install -g ndjson-cli
# npm install -g d3-dsv
# npm install -g topojson

source ../.env

rm temp/*.*

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
if [ ! -e 2016my_us_county_pop.json ]; then
    curl "https://api.census.gov/data/2016/pep/population?get=DATE,POP,GEONAME&for=county:*&key=${CENSUS_GOV_API_KEY}" \
      -o 2016my_us_county_pop.json
fi

# clean up and organize population estimate data
ndjson-cat 2016my_us_county_pop.json \
  | ndjson-split 'd.slice(1)' \
  | ndjson-map '{id: d[3] + d[4], county: d[2], date: d[0], pop: +d[1]}' \
  | sed 's/"date":"1","pop"/"census2010pop"/g' \
  | sed 's/"date":"2","pop"/"estimatesbase2010"/g' \
  | sed 's/"date":"3","pop"/"popestimate2010"/g' \
  | sed 's/"date":"4","pop"/"popestimate2011"/g' \
  | sed 's/"date":"5","pop"/"popestimate2012"/g' \
  | sed 's/"date":"6","pop"/"popestimate2013"/g' \
  | sed 's/"date":"7","pop"/"popestimate2014"/g' \
  | sed 's/"date":"8","pop"/"popestimate2015"/g' \
  | sed 's/"date":"9","pop"/"popestimate2016"/g' \
  | ndjson-reduce 'idx = p.findIndex((el) => (el.id === d.id)), idx > -1 ? p[idx] = Object.assign(p[idx], d) : p.push(d), p' '[]' \
  | ndjson-split \
  > temp/2016_us_county_pop.ndjson

# create a csv file of the population data
json2csv -n < temp/2016_us_county_pop.ndjson > temp/2016_us_county_pop.csv

# join the population data into the geojson
ndjson-join 'd.id' \
  temp/cb_2016_us_county_20m-albers.id.geo.ndjson \
  temp/2016_us_county_pop.ndjson \
  > temp/cb_2016_us_county_20m-albers-join.ndjson

# trim the properties for each county into a single properties object
ndjson-map 'd[0].properties = {county: d[1].county}, d[0]' \
  < temp/cb_2016_us_county_20m-albers-join.ndjson \
  > temp/cb_2016_us_county_20m-albers-trim.ndjson

# convert the ndjson back to geojson
ndjson-reduce 'p.features.push(d), p' '{type: "FeatureCollection", features: []}' \
  < temp/cb_2016_us_county_20m-albers-trim.ndjson \
  > temp/cb_2016_us_county_20m-albers-trim.geo.json

geo2topo -n \
  counties=temp/cb_2016_us_county_20m-albers-trim.ndjson \
  > temp/cb_2016_us_county_20m-albers-trim.topo.json

toposimplify -p 1 -f \
  < temp/cb_2016_us_county_20m-albers-trim.topo.json \
  > temp/cb_2016_us_county_20m-albers-simple.topo.json

topoquantize 1e5 \
  < temp/cb_2016_us_county_20m-albers-simple.topo.json \
  > temp/cb_2016_us_county_20m-albers-quantized.topo.json

# copy the geojson and population data into the assets folder so that it can be visualized
cp temp/cb_2016_us_county_20m-albers-trim.geo.json ../src/assets
cp temp/cb_2016_us_county_20m-albers-quantized.topo.json ../src/assets
cp temp/2016_us_county_pop.csv ../src/assets
