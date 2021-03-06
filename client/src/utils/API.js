const percentile = require('percentile'); // calculates percentiles

// this is to get all the hosts based on tags
export const getHostUnitConsumption = (tenantId, apiToken, tags) => {
  if (tenantId.slice(-1) !== '/') {
    tenantId = tenantId.concat('/')
  }
  const apiTags = tags.length === 0 ? '' : `&tag=${tags.toString()}`;
  console.log(apiTags);
  return fetch(
    `${tenantId}api/v1/entity/infrastructure/hosts?showMonitoringCandidates=false${apiTags}`,
    {
      headers: {
        'Content-Type': 'application/json',
        authorization: `Api-Token ${apiToken}`,
      },
    }
  );
};

// this is to get all the monitors based on tags
export const getSynMonitors = (tenantId, apiToken) => {
  if (tenantId.slice(-1) !== '/') {
    tenantId = tenantId.concat('/')
  }
  return fetch(`${tenantId}api/v1/synthetic/monitors`, {
    headers: {
      'Content-Type': 'application/json',
      authorization: `Api-Token ${apiToken}`,
    },
  });
};

const getSynMonConfig = (tenantId, monitorId, apiToken) => {
  if (tenantId.slice(-1) !== '/') {
    tenantId = tenantId.concat('/')
  }
  fetch(`${tenantId}api/v1/synthetic/monitors/${monitorId}`, {
    headers: {
      'Content-Type': 'application/json',
      authorization: `Api-Token ${apiToken}`,
    },
  })
    .then((response) => response.json())
    .then((result) => {
      delete result['entityId'];
      result.enabled = !result.enabled;
      //now go send it and change it
      fetch(`${tenantId}api/v1/synthetic/monitors/${monitorId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Api-Token ${apiToken}`,
        },
        body: JSON.stringify(result),
        redirect: 'follow',
      })
        .then((response) => response.text())
        .then((result) => console.log(`changed for monitor ${monitorId}`))
        .catch((error) => console.log('error', error));
    })
    .catch((error) => console.log('error', error));
};

export const changeSynMonConfig = async (tenantId, apiToken, entitiesIdArr) => {
  if (tenantId.slice(-1) !== '/') {
    tenantId = tenantId.concat('/')
  }
  console.log('entitiesIdArr:', entitiesIdArr);
  entitiesIdArr.map((entityId) => {
    getSynMonConfig(tenantId, entityId, apiToken);
  });

};

export const k8sHUReportMemUsed = (tenantId, apiToken, tags) => {
  if (tenantId.slice(-1) !== '/') {
    tenantId = tenantId.concat('/')
  }
  //amount of memory in GB
  const headers = {
    Authorization: `Api-Token ${apiToken}`,
    Accept: 'application/json',
  }; // headers used during api calls
  let k8shosts = []; // array to store list of k8s hosts
  let apiURI = ''; // used to stage api endpoints before querying
  let removeHosts = []; // list of k8s hosts with no memory metrics for the period
  let detailData = []; // fow raw data report when detailedReport is enabled
  let nextKey = null; // to track next page key so we can handle pagination
  const percentileCutoff = 99; // percentile to calculate HU
  // route to get logged in user's info (needs the token)
  const detailedReport = false;
  const apiTags = tags.length === 0 ? '' : `&tag=${tags.toString()}`;
  // get start and end timestamps based on last month
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const y = d.getFullYear(),
    m = d.getMonth();
  const from = new Date(y, m, 1).getTime();
  const to = new Date(y, m + 1, 0).getTime();

  // Fetch hosts running k8s
  apiURI = `api/v1/entity/infrastructure/hosts?showMonitoringCandidates=false${apiTags}`;
  return (async () => {
    try {
      console.log(`${tenantId}${apiURI}`);
      let r = await fetch(`${tenantId}${apiURI}`, { headers: headers });
      let rj = await r.json();
      k8shosts = await Promise.all(
        rj.map(async (h) => {
          if (h.hasOwnProperty('softwareTechnologies')) {
            for (let i of h.softwareTechnologies) {
              if (
                i.type.toUpperCase() === 'KUBERNETES' &&
                h.monitoringMode.toUpperCase() === 'FULL_STACK'
              ) {
                return {
                  entityId: h.entityId,
                  displayName: h.displayName,
                  consumedHostUnits: h.consumedHostUnits,
                };
              }
            }
          }
        })
      );
      k8shosts = await k8shosts.filter(function (el) {
        return el != null;
      });
    } catch (err) {
      console.log(err);
    }
  })()
    .then(async () => {
      // Fetch metrics for memory utilization
      apiURI = 'api/v2/metrics/query';
      let queryString = `?metricSelector=builtin:host.mem.used:max&resolution=1h&from=${from}&to=${to}`; //SANTI needs to change from used to usage
      console.log(`${tenantId}${apiURI}${queryString}&pageSize=100`);
      let r = await fetch(`${tenantId}${apiURI}${queryString}&pageSize=100`, {
        headers: headers,
      });
      let rj = await r.json();
      nextKey = rj.nextPageKey;
      await Promise.all(
        rj.result[0].data.map(async (h) => {
          let x = await k8shosts.findIndex(
            (i) => i.entityId === h.dimensions[0]
          );
          if (x > -1) {
            k8shosts[x].memory = percentile(
              percentileCutoff,
              h.values.filter((obj) => obj)
            ); // trimming out null values
            if (detailedReport) {
              detailData.push([k8shosts[x].entityId, ...h.values]);
            }
          }
        })
      );
    })
    .then(async () => {
      const fetchNext = async (k) => {
        console.log(`${tenantId}${apiURI}?nextPageKey=${k}`);
        let r = await fetch(`${tenantId}${apiURI}?nextPageKey=${k}`, {
          headers: headers,
        });
        let rj = await r.json();
        nextKey = rj.nextPageKey;
        await Promise.all(
          rj.result[0].data.map(async (h) => {
            let x = await k8shosts.findIndex(
              (i) => i.entityId === h.dimensions[0]
            );
            if (x > -1) {
              k8shosts[x].memory = await percentile(
                percentileCutoff,
                h.values.filter((obj) => obj)
              ); // trimming out null values
              if (detailedReport) {
                detailData.push([k8shosts[x].entityId, ...h.values]);
              }
            }
          })
        );
        return rj.nextPageKey;
      };
      // loop function wrapped in promise, so we can wait to continue until we've run all the needed api calls
      const loopy = async () => {
        return new Promise(async (resolve) => {
          while (nextKey != null) {
            nextKey = await fetchNext(nextKey);
          }
          resolve();
        });
      };
      // run the loop then continue
      loopy()
        .then(async () => {
          // calculate HUs and drop into a CSV
          // convert bytes to gb, calc HU and calculate totals
          k8shosts.map(async (host) => {
            // if there's no memory metrics for the host, it wasn't running during the period
            if (host.hasOwnProperty('memory')) {
              let memInGb = parseFloat((host.memory / 1073741824).toFixed(2));
              host.memory = memInGb;
            } else {
              removeHosts.push(host);
            }
          });
        })
        .catch((error) => {
          console.log(error);
        })
        .finally(async () => {
          for (let x = removeHosts.length - 1; x > -1; x--) {
            k8shosts.splice(removeHosts[x], 1);
          }
        })
        .catch((error) => {
          console.log(error);
        });
    })
    .catch(function (error) {
      // handle error
      console.log(error);
    })
    .then(async () => {
      return {
        hosts: k8shosts,
        removed: removeHosts,
      }; ////////now memory usage
    });
};

export const k8sHUReportMemUsage = (tenantId, apiToken, tags) => {
  if (tenantId.slice(-1) !== '/') {
    tenantId = tenantId.concat('/')
  }
  const headers = {
    Authorization: `Api-Token ${apiToken}`,
    Accept: 'application/json',
  }; // headers used during api calls
  let k8shosts = []; // array to store list of k8s hosts
  let apiURI = ''; // used to stage api endpoints before querying
  let removeHosts = []; // list of k8s hosts with no memory metrics for the period
  let nextKey = null; // to track next page key so we can handle pagination
  const percentileCutoff = 99; // percentile to calculate HU
  // route to get logged in user's info (needs the token)

  // get start and end timestamps based on last month
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const y = d.getFullYear(),
    m = d.getMonth();
  const from = new Date(y, m, 1).getTime();
  const to = new Date(y, m + 1, 0).getTime();
  const apiTags = tags.length === 0 ? '' : `&tag=${tags.toString()}`;
  // Fetch hosts running k8s
  apiURI = `api/v1/entity/infrastructure/hosts?showMonitoringCandidates=false${apiTags}`;
  return (async () => {
    try {
      console.log(`${tenantId}${apiURI}`);
      let r = await fetch(`${tenantId}${apiURI}`, { headers: headers });
      let rj = await r.json();
      k8shosts = await Promise.all(
        rj.map(async (h) => {
          if (h.hasOwnProperty('softwareTechnologies')) {
            for (let i of h.softwareTechnologies) {
              if (
                i.type.toUpperCase() === 'KUBERNETES' &&
                h.monitoringMode.toUpperCase() === 'FULL_STACK'
              ) {
                return {
                  entityId: h.entityId,
                };
              }
            }
          }
        })
      );
      k8shosts = await k8shosts.filter(function (el) {
        return el != null;
      });
    } catch (err) {
      console.log(err);
    }
  })()
    .then(async () => {
      // Fetch metrics for memory utilization
      apiURI = 'api/v2/metrics/query';
      let queryString = `?metricSelector=builtin:host.mem.usage:max&resolution=1h&from=${from}&to=${to}`;
      console.log(`${tenantId}${apiURI}${queryString}&pageSize=100`);
      let r = await fetch(`${tenantId}${apiURI}${queryString}&pageSize=100`, {
        headers: headers,
      });
      let rj = await r.json();
      nextKey = rj.nextPageKey;
      await Promise.all(
        rj.result[0].data.map(async (h) => {
          let x = await k8shosts.findIndex(
            (i) => i.entityId === h.dimensions[0]
          );
          if (x > -1) {
            k8shosts[x].memoryUsage = percentile(
              percentileCutoff,
              h.values.filter((obj) => obj)
            ); // trimming out null values
          }
        })
      );
    })
    .then(async () => {
      const fetchNext = async (k) => {
        console.log(`${tenantId}${apiURI}?nextPageKey=${k}`);
        let r = await fetch(`${tenantId}${apiURI}?nextPageKey=${k}`, {
          headers: headers,
        });
        let rj = await r.json();
        nextKey = rj.nextPageKey;
        await Promise.all(
          rj.result[0].data.map(async (h) => {
            let x = await k8shosts.findIndex(
              (i) => i.entityId === h.dimensions[0]
            );
            if (x > -1) {
              k8shosts[x].memoryUsage = await percentile(
                percentileCutoff,
                h.values.filter((obj) => obj)
              ); // trimming out null values
            }
          })
        );
        return rj.nextPageKey;
      };
      // loop function wrapped in promise, so we can wait to continue until we've run all the needed api calls
      const loopy = async () => {
        return new Promise(async (resolve) => {
          while (nextKey != null) {
            nextKey = await fetchNext(nextKey);
          }
          resolve();
        });
      };
      // run the loop then continue
      loopy()
        .then(async () => {
          k8shosts.map(async (host) => {
            // if there's no memory metrics for the host, it wasn't running during the period
            if (host.hasOwnProperty('memoryUsage')) {
              host.memoryUsage = parseFloat(host.memoryUsage.toFixed(2));
            } else {
              removeHosts.push(host);
            }
          });
        })
        .catch((error) => {
          console.log(error);
        })
        .finally(async () => {
          // stage csv, add totals and dump everything to a file
          for (let x = removeHosts.length - 1; x > -1; x--) {
            k8shosts.splice(removeHosts[x], 1);
          }
        })
        .catch((error) => {
          console.log(error);
        });
    })
    .catch(function (error) {
      // handle error
      console.log(error);
    })
    .then(async () => {
      return {
        hosts: k8shosts,
        removed: removeHosts,
      }; ////////now memory usage
    });
};
