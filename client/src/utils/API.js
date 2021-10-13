const percentile = require('percentile'); // calculates percentiles

export const getMe = (token) => {
  return fetch('/api/users/me', {
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${token}`,
    },
  });
};

export const createUser = (userData) => {
  return fetch('/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });
};

export const loginUser = (userData) => {
  return fetch('/api/users/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });
};

// save book data for a logged in user
export const saveBook = (bookData, token) => {
  return fetch('/api/users', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(bookData),
  });
};

// remove saved book data for a logged in user
export const deleteBook = (bookId, token) => {
  return fetch(`/api/users/books/${bookId}`, {
    method: 'DELETE',
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
};

// make a search to google books api
// https://www.googleapis.com/books/v1/volumes?q=harry+potter
export const searchGoogleBooks = (query) => {
  return fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}`);
};

// this is to get all the hosts based on tags
export const getHostUnitConsumption = (tenantId, apiToken, tags) => {
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

export const k8sHUReportMemUsed = (tenantId, apiToken, tags) => {   //amount of memory in GB
  const headers = {
    Authorization: `Api-Token ${apiToken}`,
    Accept: 'application/json',
  }; // headers used during api calls
  let k8shosts = []; // array to store list of k8s hosts
  let apiURI = ''; // used to stage api endpoints before querying
  let totalMem = 0;
  let totalHU = 0;
  let totalOldHU = 0; // to calculate total memory and HUs
  let removeHosts = []; // list of k8s hosts with no memory metrics for the period
  let detailData = []; // fow raw data report when detailedReport is enabled
  let nextKey = null; // to track next page key so we can handle pagination
  const huFactor = 16; // number of GB per HU
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
      await console.log('k8shosts!!!!!!!!!!!!!!!!:', k8shosts)
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
      console.log('rj:', rj)
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
              let memInGb = parseFloat((host.memory / 1073741824).toFixed(2)); // SANTI need to comment "/ 1073741824" for mem usage
              // let hu = Math.ceil(memInGb / huFactor);
              // hu = hu > host.consumedHostUnits ? host.consumedHostUnits : hu; // in case host is at or near capacity
              host.memory = memInGb; // SANTI need to comment for mem usage
              // totalMem += host.memory;
              // host.hostUnits = hu;
              // totalHU += hu;
              // totalOldHU += host.consumedHostUnits;
            } else {
              removeHosts.push(host)
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
          const totals = [
            {
              entityId: 'TOTALS',
              displayName: '',
              memory: totalMem,
              consumedHostUnits: totalOldHU,
              hostUnits: totalHU,
            },
          ];
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
        // totalMem,
        // totalOldHU,
        // totalHU,
        removed: removeHosts,
      }; ////////now memory usage
    });
};

export const k8sHUReportMemUsage = (tenantId, apiToken, tags) => {
  const headers = {
    Authorization: `Api-Token ${apiToken}`,
    Accept: 'application/json',
  }; // headers used during api calls
  let k8shosts = []; // array to store list of k8s hosts
  let apiURI = ''; // used to stage api endpoints before querying
  let totalMem = 0;
  let totalHU = 0;
  let totalOldHU = 0; // to calculate total memory and HUs
  let removeHosts = []; // list of k8s hosts with no memory metrics for the period
  let detailData = []; // fow raw data report when detailedReport is enabled
  let nextKey = null; // to track next page key so we can handle pagination
  const huFactor = 16; // number of GB per HU
  const percentileCutoff = 99; // percentile to calculate HU
  // route to get logged in user's info (needs the token)
  const detailedReport = false;

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
      let queryString = `?metricSelector=builtin:host.mem.usage:max&resolution=1h&from=${from}&to=${to}`; //SANTI needs to change from used to usage
      console.log(`${tenantId}${apiURI}${queryString}&pageSize=100`);
      let r = await fetch(`${tenantId}${apiURI}${queryString}&pageSize=100`, {
        headers: headers,
      });
      let rj = await r.json();
      console.log('rj:', rj)
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
              host.memoryUsage = parseFloat((host.memoryUsage).toFixed(2));
            } else {
              removeHosts.push(host)
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
        removed: removeHosts
      }; ////////now memory usage
    });
};


