# Visualization of U.S. Population in VR

A visualization of the United States population by county using WebVR.

[![VR U.S. Population](./src/assets/preview.png)](https://sbrudz.github.io/vr-us-population/)

**Note**: This is still a work in progress and I'm in the process of ironing out performance issues.

## About the Data

The visualization uses data from [census.gov](https://census.gov) for both the map and the population estimates.
The `data` subdirectory contains the source data files used in the visualization.  

The script `data/build-data-files.sh`
provides a reproducable way to download and process the data files into the versions in `src/assets` that are used
directly in the visualization.  Note that build-data-files.sh must be run from within the `data` subdirectory.  It also
requires several globally installed npm packages.  See the header of the file for details.

If you want to re-download the data files, you'll need a [census.gov API key](https://api.census.gov/data/key_signup.html).
Make a copy of .env.example, name it .env, and put your API key there.

Finally, per the instructions on census.gov, I must state that "This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau."

### Local Development

First make sure you have Node installed.

On Mac OS X, it's recommended to use [Homebrew](http://brew.sh/) to install Node + [npm](https://www.npmjs.com):

    brew install node

To install the Node dependencies:

    npm install

To serve the site from a simple Node development server:

    npm start

Then launch the site from your favorite browser:

[__http://localhost:3000/__](http://localhost:3000/)

To deploy changes to github pages, run:

    npm run deploy

## License

This program is free software and is distributed under an [MIT License](LICENSE).
