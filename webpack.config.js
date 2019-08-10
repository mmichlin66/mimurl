let isProd = process.argv.indexOf('-p') !== -1;
let mode = isProd ? "production" : "development";
let devtool = isProd ? "source-map" : "#inline-source-map";
let outputFilename = isProd ? "mimurl.js" : "mimurl.dev.js";


// define preprocessor variables for ifdef-loader
const ifdefLoaderOptions =
{
    DEBUG: !isProd,

    //"ifdef-verbose": true,       // add this for verbose output
    //"ifdef-triple-slash": false  // add this to use double slash comment instead of default triple slash
};



module.exports =
{
    entry: "./src/mimurlTypes.ts",

    output:
    {
        filename: outputFilename,
        path: __dirname + "/dist",
		library: 'mimurl',
		libraryTarget: 'umd',
		globalObject: 'this'
    },

    mode: mode,
    //mode: "production",
    //mode: "none",

    // Enable sourcemaps for debugging webpack's output.
    devtool: devtool,
    //devtool: "source-map",

    resolve:
    {
        // Add resolvable extensions.
        extensions: [".ts", ".js", ".json"]
    },

    module:
    {
        rules:
        [
            {
                test: /\.tsx?$/,
                use:
                [
                    //{ loader: "awesome-typescript-loader" },
                    { loader: "ts-loader" },
                    { loader: "ifdef-loader", options: ifdefLoaderOptions }
                ]
            },

            // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
            { enforce: "pre", test: /\.js$/, loader: "source-map-loader" }
        ]
    },
};