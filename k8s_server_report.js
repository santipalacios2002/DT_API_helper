const server_report = (tenantURL, apiKey, tags, mzs, filePath, huFactor, percentileCutoff, detailedReport) => {
    // Load required packages
    //const axios = require('axios'); // for making http calls
    const fetch = require('node-fetch');
    const percentile = require("percentile"); // calculates percentiles
    const createCsvWriter = require('csv-writer').createObjectCsvWriter; // for building csv from objects
    const createArrayCsvWriter = require('csv-writer').createArrayCsvWriter; // for building csv from arrays

    // Setup variables
    const headers = {
        'Authorization': `Api-Token ${apiKey}`,
        'Accept': 'application/json'
    }; // headers used during api calls
    let k8shosts = []; // array to store list of k8s hosts
    let apiURI = ''; // used to stage api endpoints before querying
    let totalMem = 0, totalHU = 0; totalOldHU = 0; // to calculate total memory and HUs
    let removeHosts = []; // list of k8s hosts with no memory metrics for the period
    let detailData = []; // fow raw data report when detailedReport is enabled
    let nextKey = null; // to track next page key so we can handle pagination

    // get start and end timestamps based on last month
    const d = new Date();
    console.log('d:', d)

    d.setMonth(d.getMonth() - 1)
    console.log('d.setMonth(d.getMonth() - 1):', d.setMonth(d.getMonth() - 1))
    const y = d.getFullYear(), m = d.getMonth();
    console.log('y:', y)
    const from = (new Date(y, m, 1)).getTime();
    console.log('from:', from)
    const to = (new Date(y, m + 1, 0)).getTime();
    console.log('to:', to)

    // Fetch hosts running k8s
    apiURI = `/api/v1/entity/infrastructure/hosts?showMonitoringCandidates=false${tags}${mzs}`;
    (async () => {
        try {
            console.log(`${tenantURL}${apiURI}`);
            let r = await fetch(`${tenantURL}${apiURI}`, { 'headers': headers })
            let rj = await r.json()
            k8shosts = await Promise.all(
                rj.map(async h => {
                    if (h.hasOwnProperty('softwareTechnologies')) {
                        for (let i of h.softwareTechnologies) {
                            if (i.type.toUpperCase() == 'KUBERNETES' && h.monitoringMode.toUpperCase() === 'FULL_STACK') {
                                return {
                                    'entityId': h.entityId,
                                    'displayName': h.displayName,
                                    'consumedHostUnits': h.consumedHostUnits
                                }
                            }
                        }
                    }
                })
                )
            console.log('k8shosts:', k8shosts)
            k8shosts = await k8shosts.filter(function (el) {
                return el != null;
            });
        } catch (err) {
            console.log(err)
        }
    }
    )().then(async () => {
        // Fetch metrics for memory utilization
        apiURI = '/api/v2/metrics/query'
        let queryString = `?metricSelector=builtin:host.mem.used:max&resolution=1h&from=${from}&to=${to}`; //SANTI needs to change from used to usage
        console.log(`${tenantURL}${apiURI}${queryString}&pageSize=100`);
        let r = await fetch(`${tenantURL}${apiURI}${queryString}&pageSize=100`, { 'headers': headers })
        let rj = await r.json();
        nextKey = rj.nextPageKey;
        if (detailedReport) {
            let line = ['', ...rj.result[0].data[0].timestamps];
            detailData.push(line);
        }
        await Promise.all(
            rj.result[0].data.map(async h => {
                let x = await k8shosts.findIndex((i) => i.entityId == h.dimensions[0]);
                if (x > -1) {
                    k8shosts[x].memory = percentile(percentileCutoff, h.values.filter((obj) => obj)); // trimming out null values
                    if (detailedReport) {
                        detailData.push([k8shosts[x].entityId, ...h.values]);
                    }
                }
            })
        )
    }).then(async () => {
        const fetchNext = async (k) => {
            console.log(`${tenantURL}${apiURI}?nextPageKey=${k}`);
            let r = await fetch(`${tenantURL}${apiURI}?nextPageKey=${k}`, { 'headers': headers })
            let rj = await r.json();
            nextKey = rj.nextPageKey;
            await Promise.all(
                rj.result[0].data.map(async h => {
                    let x = await k8shosts.findIndex((i) => i.entityId == h.dimensions[0]);
                    if (x > -1) {
                        k8shosts[x].memory = await percentile(percentileCutoff, h.values.filter((obj) => obj)); // trimming out null values
                        if (detailedReport) {
                            detailData.push([k8shosts[x].entityId, ...h.values]);
                        }
                    }
                })
            )
            return rj.nextPageKey;
        }
        // loop function wrapped in promise, so we can wait to continue until we've run all the needed api calls
        const loopy = async () => {
            return new Promise(async (resolve) => {
                while (nextKey != null) {
                    nextKey = await fetchNext(nextKey);
                }
                resolve();
            })
        }
        // run the loop then continue
        loopy().then(async () => {
            // calculate HUs and drop into a CSV
            // convert bytes to gb, calc HU and calculate totals
            k8shosts.map(async (host) => {
                // if there's no memory metrics for the host, it wasn't running during the period
                if (host.hasOwnProperty('memory')) {
                    let memInGb = parseFloat((host.memory / 1073741824).toFixed(2));  // SANTI need to comment "/ 1073741824" for mem usage
                    let hu = Math.ceil(memInGb / huFactor);
                    hu = hu > host.consumedHostUnits ? host.consumedHostUnits : hu; // in case host is at or near capacity
                    host.memory = memInGb;   // SANTI need to comment for mem usage
                    totalMem += host.memory;
                    host.hostUnits = hu;
                    totalHU += hu;
                    totalOldHU += host.consumedHostUnits;
                } else { /*removeHosts.push(host)*/ }
            })
        }).catch((error) => { console.log(error) }).finally(async () => {
            // stage csv, add totals and dump everything to a file
            for (let x = removeHosts.length - 1; x > -1; x--) {
                k8shosts.splice(removeHosts[x], 1);
            }
            const totals = [{
                'entityId': 'TOTALS',
                'displayName': '',
                'memory': totalMem,
                'consumedHostUnits': totalOldHU,
                'hostUnits': totalHU
            }]
            const csvWriter = createCsvWriter({
                path: `${filePath}/k8s_host_${d.getTime()}.csv`,
                header: [
                    { id: 'entityId', title: 'DT_ID' },
                    { id: 'displayName', title: 'HOSTNAME' },
                    { id: 'memory', title: 'MEM_GB' },
                    { id: 'consumedHostUnits', title: 'REPORTED_HU' },
                    { id: 'hostUnits', title: 'ADJUSTED_HU' }
                ]
            });
            csvWriter.writeRecords(k8shosts)
                .then(() => {
                    csvWriter.writeRecords(totals)
                        .then(() => {
                            console.log('Host unit report complete.');
                        }).catch((e) => { console.log(e); });
                }).catch((e) => { console.log(e); });

            // if detailedReport, then write out the raw metrics
            if (detailedReport) {
                const writeDetails = createArrayCsvWriter({
                    path: `${filePath}/k8s_host_detail_${d.getTime()}.csv`
                });
                writeDetails.writeRecords(detailData)
                    .then(() => {
                        console.log('Detail report complete.');
                    }).catch((e) => { console.log(e); });
            }
        }).catch((error) => { console.log(error) });
    }).catch(function (error) {
        // handle error
        console.log(error);
    });
}
module.exports = {
    server_report: server_report,
};