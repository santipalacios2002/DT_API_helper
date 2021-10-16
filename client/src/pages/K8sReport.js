import React, { useState } from 'react';
import { Jumbotron, Container, Col, Form, Button } from 'react-bootstrap';
import { k8sHUReportMemUsed, k8sHUReportMemUsage } from '../utils/API';
import Swal from 'sweetalert2';
import 'react-bootstrap-table-next/dist/react-bootstrap-table2.min.css';
import BootstrapTable from 'react-bootstrap-table-next';
import ToolkitProvider, {
  Search,
  CSVExport,
} from 'react-bootstrap-table2-toolkit';
import filterFactory, { textFilter } from 'react-bootstrap-table2-filter';
import ReactTagInput from '@pathofdev/react-tag-input';
import '@pathofdev/react-tag-input/build/index.css';

const { SearchBar, ClearSearchButton } = Search;
const { ExportCSVButton } = CSVExport;
const d = new Date();
d.setMonth(d.getMonth() - 1);
const options = { month: 'long' };
const columns = [
  {
    dataField: 'id',
    text: '#',
    sort: true,
  },
  {
    dataField: 'name',
    text: 'Host Name',
    filter: textFilter(),
    sort: true,
  },
  {
    dataField: 'entityId',
    text: 'Host Entity ID',
  },
  {
    dataField: 'hus',
    text: 'Reported HUs',
    sort: true,
  },
  {
    dataField: 'totalmemUsed',
    text: 'Total Memory (GB)',
    sort: true,
  },
  {
    dataField: 'memoryUsageInPer',
    text: 'Memory Used %',
    sort: true,
  },
  {
    dataField: 'calculatedHUs',
    text: 'Calculated HUs',
    sort: true,
  },
];

const defaultSorted = [
  {
    dataField: 'id',
    order: 'asc',
  },
];
let totalHUsConsumed = 0;
let HUdata = [];
const K8sReport = () => {
  // create state for holding our tenantId field data  **SANTIAGO
  const [tenantId, setTenantId] = useState('');
  // create state for holding our API Token field data  **SANTIAGO
  const [apiToken, setapiToken] = useState('');
  // create state for getting the total host units  **SANTIAGO
  const [total, setTotal] = useState(false);
  // create state for the hosts  **SANTIAGO
  const [Hosts, setHosts] = useState([]);
  // // create state for tags  **SANTIAGO
  const [tags, setTags] = useState([]);

  // create method to get the information from the tenant
  const handleDynatraceFormSubmit = async (event) => {
    event.preventDefault();
    HUdata = [];
    Swal.fire({
      title: 'Loading',
      timerProgressBar: true,
      didOpen: () => {
        if (tenantId || apiToken) {
          Swal.showLoading();
        }
      },
    });
    if (!(tenantId || apiToken)) {
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'Please make sure you have a tenant and token',
        timer: 3000,
        timerProgressBar: true,
      });
      console.log('something is missing');
      return false;
    }

    try {
      const response = await k8sHUReportMemUsed(tenantId, apiToken, tags);
      const response2 = await k8sHUReportMemUsage(tenantId, apiToken, tags);
      if (!response.hosts) {
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Something went wrong!',
          timer: 3000,
          timerProgressBar: true,
          footer: `<strong>${response.status} - (${response.statusText}). Please verify tenant and token</strong>`,
        });
        throw new Error('something went wrong!');
      }

      const items = await response;
      const items2 = await response2;
      for (let index = 0; index < items.hosts.length; index++) {
        const memUsage = parseFloat(
          (
            (items.hosts[index].memory * 100) /
            items2.hosts[index].memoryUsage
          ).toFixed(2)
        ); //gets the total memory used in GB
        const obj = {
          entityId: items.hosts[index].entityId,
          displayName: items.hosts[index].displayName,
          // "hostUnits": items.hosts[index].hostUnits,
          consumedHostUnits: items.hosts[index].consumedHostUnits,
          memoryUsed: items.hosts[index].memory,
          memoryTotalInGB: memUsage,
          memoryUsageInPer: items2.hosts[index].memoryUsage,
        };
        if (items.hosts[index].memory) {
          HUdata.push(obj);
        }
      }
      HUdata.map((host) => {
        if (host.memoryUsageInPer < 10) {
          host.hostUnits = parseFloat(
            ((host.memoryTotalInGB * 0.125) / 16).toFixed(1)
          );
          if (host.hostUnits % 1 !== 0.5) {
            host.hostUnits = Math.ceil(host.hostUnits);
          }
        } else if (host.memoryUsageInPer < 20) {
          host.hostUnits = parseFloat(
            ((host.memoryTotalInGB * 0.25) / 16).toFixed(1)
          );
          if (host.hostUnits % 1 !== 0.5) {
            host.hostUnits = Math.ceil(host.hostUnits);
          }
        } else if (host.memoryUsageInPer < 40) {
          host.hostUnits = parseFloat(
            ((host.memoryTotalInGB * 0.5) / 16).toFixed(1)
          );
          if (host.hostUnits % 1 !== 0.5) {
            host.hostUnits = Math.ceil(host.hostUnits);
          }
        } else {
          host.hostUnits = parseFloat((host.memoryTotalInGB / 16).toFixed(1));
          if (host.hostUnits % 1 !== 0.5) {
            host.hostUnits = Math.ceil(host.hostUnits);
          }
        }
      });
      totalHUsConsumed = HUdata.reduce(
        (total, value) => total + value.hostUnits,
        0
      ).toFixed(2);
      setTotal(true);

      const hosts2 = HUdata.map((host, index) => {
        return {
          id: index + 1,
          name: host.displayName,
          entityId: host.entityId,
          hus: host.consumedHostUnits,
          calculatedHUs: host.hostUnits,
          totalmemUsed: parseFloat(host.memoryTotalInGB.toFixed(1)),
          memoryUsageInPer: host.memoryUsageInPer,
        };
      });
      setHosts(hosts2);
      localStorage.setItem('totalHUs', totalHUsConsumed);
      Swal.close();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <Jumbotron
        fluid
        className='text-light'
        style={{ backgroundColor: '#191919' }}>
        <Container>
          <h1>
            Get k8s consumption report for the month of{' '}
            {`${new Intl.DateTimeFormat('en-US', options).format(d)}`}
          </h1>
          <Form onSubmit={handleDynatraceFormSubmit}>
            <Form.Row>
              <Col xs={12} md={8} className='mb-3'>
                <Form.Control
                  name='tenantId'
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  onKeyPress={(e) => {
                    e.key === 'Enter' && e.preventDefault();
                  }}
                  type='text'
                  size='lg'
                  placeholder='https://TENANT_ID.live.dynatrace.com/'
                />
              </Col>
            </Form.Row>
            <Form.Row>
              <Col xs={12} md={8} className='mb-3'>
                <ReactTagInput
                  tags={tags}
                  placeholder='Enter your HOST tags'
                  onChange={(newTags) => setTags(newTags)}
                />
              </Col>
            </Form.Row>
            <Form.Row>
              <Col xs={12} md={8}>
                <Form.Control
                  name='apiToken'
                  value={apiToken}
                  onChange={(e) => setapiToken(e.target.value)}
                  onKeyPress={(e) => {
                    e.key === 'Enter' && e.preventDefault();
                  }}
                  type='password'
                  size='lg'
                  placeholder='API Token'
                />
              </Col>
              <Col xs={12} md={4}>
                <Button
                  type='submit'
                  variant='success'
                  size='lg'
                  style={{
                    backgroundColor: '#4fd5e0',
                    border: 'none',
                    color: 'black',
                  }}>
                  Submit Search
                </Button>
              </Col>
            </Form.Row>
          </Form>
        </Container>
      </Jumbotron>
      {total ? (
        <Container fluid>
          <h2>
            Your tenant is consuming a total of {totalHUsConsumed} Calculate
            Host Units as per the contract across {Hosts.length} Hosts
          </h2>
          <ToolkitProvider
            bootstrap4
            keyField='entityId'
            data={Hosts}
            columns={columns}
            defaultSorted={defaultSorted}
            striped
            hover
            condensed
            search>
            {(props) => (
              <div>
                <h3>Global Search:</h3>
                <SearchBar {...props.searchProps} />
                <ClearSearchButton {...props.searchProps} />
                <ExportCSVButton
                  size='xs'
                  style={{
                    backgroundColor: '#4fd5e0',
                    border: 'none',
                    marginLeft: '45%',
                    marginRight: '40px',
                    paddingTop: '8px',
                    paddingBottom: '8px',
                  }}
                  {...props.csvProps}>
                  Export to CSV
                </ExportCSVButton>
                <BootstrapTable {...props.baseProps} filter={filterFactory()} />
              </div>
            )}
          </ToolkitProvider>
        </Container>
      ) : (
        <h2 className='justify-content-md-center'>
          Enter your tenant and API token
        </h2>
      )}
    </>
  );
};

export default K8sReport;
