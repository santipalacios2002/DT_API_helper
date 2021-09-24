const server_report = require('./k8s_server_report').server_report
//const chargeback_report = require('./k8s_chargeback_report').chargeback_report
require('dotenv').config(); // read in vars from .env
const fs = require('fs'); // access filesystem to check and create dir if required


// load config
const tenantURLs = process.env.TENANT_URL.split('||');
for (let x in tenantURLs) {
    console.log('tenantURLs:', tenantURLs)
    console.log(x)
    tenantURLs[x] = tenantURLs[x].slice(-1) === '/' ? tenantURLs[x].slice(0, -1) : tenantURLs[x]; // tenant url
}
const apiKeys = process.env.DYNATRACE_API_KEY.split('||');
const tags = process.env.HOST_TAGS == null ? '' : `&tag=${process.env.HOST_TAGS.split(',').join('&tag=')}`; // if tags are set, store as query string
const mzs = process.env.MZ == null ? '' : `&managementZone=${process.env.MZ}`; // if mz is set, store as query string
const huFactor = 16; // number of GB per HU
const percentileCutoff = 99; // percentile to calculate HU

// Handle command line args
var argv = require('yargs')
    .usage('Usage: $0 [-s, -c, -p <path to directory>]')
    .boolean('u')
    .boolean('c')
    .default('p', process.env.FILE_PATH == null ? './export' : process.env.FILE_PATH)
    .describe('p', 'Directory path to store reports ("./some/path")')
    .describe('u', 'Run host unit report')
    .describe('c', 'Run container memory and namespace report')
    .argv;
    console.log('argv:', argv)

// see if the dir already exists. if not, create it or fall back to ./ if not able to
try {
    if (!fs.existsSync(argv.p)) {
        fs.mkdirSync(argv.p);
    }
} catch (e) {
    // no permission to create dir, so just store in ./
    argv.p = './';
}
if (argv.u)
    for (let x in tenantURLs) {
        server_report(tenantURLs[x], apiKeys[x], tags, mzs, argv.p, huFactor, percentileCutoff, argv.details);
    }
if (argv.c)
    for (let x in tenantURLs) {
        chargeback_report(tenantURLs[x], apiKeys[x], tags, argv.p);
    }
if (!argv.u & !argv.c)
    console.log(`You've opted to run no reports... Try passing -u, -c or both.`)