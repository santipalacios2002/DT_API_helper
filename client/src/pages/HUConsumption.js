import React, { useState, useEffect } from 'react';
import {
  Jumbotron,
  Container,
  Col,
  Form,
  Button,
  Card,
  CardColumns,
  Table,
} from 'react-bootstrap';
import Auth from '../utils/auth';
import {
  saveBook,
  searchGoogleBooks,
  getHostUnitConsumption,
} from '../utils/API';
import { saveBookIds, getSavedBookIds } from '../utils/localStorage';
import Swal from 'sweetalert2';
import 'react-bootstrap-table-next/dist/react-bootstrap-table2.min.css';
import BootstrapTable from 'react-bootstrap-table-next';
import ToolkitProvider, {
  Search,
  CSVExport,
} from 'react-bootstrap-table2-toolkit';

// const products = [ {id: 1, name: 'hello', entityId: '1234', hus: 2, mon_mode: 'full'} ];
const { SearchBar, ClearSearchButton } = Search;
const columns = [
  {
    dataField: 'id',
    text: '#',
    sort: true,
  },
  {
    dataField: 'name',
    text: 'Host Name',
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
  // console.log('Hosts:', Hosts)
  // create state for the loading flag  **SANTIAGO
  const [isLoading, setIsLoading] = useState(false);
  // console.log('isLoading:', isLoading)




  // create method to get the information from the tenant
  const handleDynatraceFormSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);

    Swal.fire({
      title: 'Loading',
      // html: 'I will close in <b></b> milliseconds.',
      timerProgressBar: true,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    // console.log('dynatrace handled: ', {tenantId, apiToken})
    if (!(tenantId || apiToken)) {
      console.log('something is missing');
      return false;
    }
    localStorage.setItem('tenantUrl', tenantId);
    localStorage.setItem('apiToken', apiToken);

    try {
      const response = await getHostUnitConsumption(tenantId, apiToken);

      if (!response.ok) {
        // console.log('response!!!!!!!:', response)
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Something went wrong!',
          footer: `<strong>${response.status} - (${response.statusText}). Please verify tenant and token</strong>`,
        });
        setIsLoading(false);
        throw new Error('something went wrong!');
      }
      const last10min = Date.now() - 600000;
      console.log('last10min:', last10min);
      const items = await response.json();
      // console.log('items:', items)
      HUdata = items
        .map((host) => {
          if (host.lastSeenTimestamp > last10min) {
            return {
              displayName: host.displayName,
              entityId: host.entityId,
              consumedHUs: host.consumedHostUnits,
              monitoringMode: host.monitoringMode,
            };
          } else return;
        })
        .filter((o) => o !== undefined);

      // console.log(HUdata)
      totalHUsConsumed = HUdata.reduce(
        (total, value) => total + value.consumedHUs,
        0
      );
      setTotal(true);
      setHosts(HUdata);
      const hosts2 = HUdata.map((host, index) => {
        return {
          id: index + 1,
          name: host.displayName,
          entityId: host.entityId,
          hus: host.consumedHUs,
          mon_mode: host.monitoringMode,
        };
      });
      setHosts(hosts2);
      console.log('hosts2:', hosts2);
      localStorage.setItem('totalHUs', totalHUsConsumed);
      setIsLoading(false);
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
          {/* copy for the form for tenant and token SANTIAGO */}
          {/* =============================================== */}
          <Form onSubmit={handleDynatraceFormSubmit}>
            <Form.Row>
              <Col xs={12} md={8} className='mb-3'>
                <Form.Control
                  name='tenantId'
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  type='text'
                  size='lg'
                  placeholder='https://TENANT_ID.live.dynatrace.com/'
                />
              </Col>
            </Form.Row>
            <Form.Row>
              <Col xs={12} md={8}>
                <Form.Control
                  name='apiToken'
                  value={apiToken}
                  onChange={(e) => setapiToken(e.target.value)}
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
          {total
            ? `Your tenant is consuming a total of ${totalHUsConsumed} with ${Hosts.length} Hosts`
            : <div className="justify-content-md-center" >Enter your tenant and API token</div>}
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
              <h3>Search or filter by any data:</h3>
              <SearchBar {...props.searchProps} />
              <ClearSearchButton {...props.searchProps} />
              <hr />
              <BootstrapTable {...props.baseProps} />
            </div>
          )}
        </ToolkitProvider>
      </Container>
    </>
  );
};

export default HUconsumption;
