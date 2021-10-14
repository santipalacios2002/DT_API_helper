import React, { useState } from 'react';
import { Jumbotron, Container, Col, Form, Button } from 'react-bootstrap';
import { getHostUnitConsumption } from '../utils/API';
import Swal from 'sweetalert2';
import 'react-bootstrap-table-next/dist/react-bootstrap-table2.min.css';
import BootstrapTable from 'react-bootstrap-table-next';
import ToolkitProvider, { Search, CSVExport } from 'react-bootstrap-table2-toolkit';
import filterFactory, { textFilter } from 'react-bootstrap-table2-filter';
import ReactTagInput from '@pathofdev/react-tag-input';
import '@pathofdev/react-tag-input/build/index.css';

const { SearchBar, ClearSearchButton } = Search;
const { ExportCSVButton } = CSVExport;
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
    text: 'Consumed HUs',
    sort: true,
  },
  {
    dataField: 'mon_mode',
    text: 'Monitoring Mode',
    filter: textFilter(),
    sort: true,
  },
  {
    dataField: 'ipAddr',
    text: 'IP Addr',
    filter: textFilter(),
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
const HUconsumption = () => {
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
    // localStorage.setItem('tenantUrl', tenantId);
    // localStorage.setItem('apiToken', apiToken);

    try {
      const response = await getHostUnitConsumption(
        tenantId,
        apiToken,
        tags
      );

      if (!response.ok) {
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
      const last10min = Date.now() - 600000;
      console.log('last10min:', last10min);
      const items = await response.json();
      HUdata = items
        .map((host) => {
          if (host.lastSeenTimestamp > last10min) {
            return {
              displayName: host.displayName,
              entityId: host.entityId,
              consumedHUs: host.consumedHostUnits,
              monitoringMode: host.monitoringMode,
              ipAddresses: host.ipAddresses.map((ip) => `${ip}, `),
            };
          } else return;
        })
        .filter((o) => o !== undefined).map((host, index) => {
          return {
            id: index + 1,
            name: host.displayName,
            entityId: host.entityId,
            hus: host.consumedHUs,
            mon_mode: host.monitoringMode,
            ipAddr: host.ipAddresses,
          };
        });;
      totalHUsConsumed = HUdata.reduce(
        (total, value) => total + value.hus,
        0
      );
      setTotal(true);
      setHosts(HUdata);
      // localStorage.setItem('totalHUs', totalHUsConsumed);
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
          <h1>Get your Host unit Consumption!</h1>
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
                  style={{ backgroundColor: '#4fd5e0', border: 'none' }}>
                  Submit Search
                </Button>
              </Col>
            </Form.Row>
          </Form>
        </Container>
      </Jumbotron>
      <Container fluid>
        <h2>
          {total ? (
            `Your tenant is consuming a total of ${totalHUsConsumed} with ${Hosts.length} Hosts`
          ) : (
            <div className='justify-content-md-center'>
              Enter your tenant and API token
            </div>
          )}
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
              <Button
                size='xs'
                style={{
                  backgroundColor: '#4fd5e0',
                  border: 'none',
                  margin: '10px',
                  paddingTop: '0',
                  paddingBottom: '0',
                }}>
              </Button>
              <hr />
              <Button
                size='xs'
                style={{
                  backgroundColor: '#4fd5e0',
                  border: 'none',
                  margin: '10px',
                  paddingTop: '0',
                  paddingBottom: '0',
                }}>
                <ExportCSVButton {...props.csvProps}>
                  Export to CSV
                </ExportCSVButton>
              </Button>
              <BootstrapTable {...props.baseProps} filter={filterFactory()} />
            </div>
          )}
        </ToolkitProvider>
      </Container>
    </>
  );
};

export default HUconsumption;
