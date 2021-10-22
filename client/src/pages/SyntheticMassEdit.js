import React, { useState } from 'react';
import { Jumbotron, Container, Col, Form, Button } from 'react-bootstrap';
import { getSynMonitors, changeSynMonConfig } from '../utils/API';
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


let changeMonArr = [];
const SyntheticMonitors = () => {
  const columns = [
    {
      dataField: 'id',
      text: '#',
      sort: true,
      headerStyle: () => {
        return { width: '5%', textAlign: 'center', color: 'white' };
      }
    },
    {
      dataField: 'synName',
      text: "Monitor's name",
      filter: textFilter(),
      sort: true,
      headerStyle: () => {
        return { textAlign: 'center', color: 'white' };
      }
    },
    {
      dataField: 'entityId',
      text: 'Monitor Entity ID',
      headerStyle: () => {
        return { textAlign: 'center', color: 'white' };
      }
    },
    {
      dataField: 'type',
      text: 'Monitor type',
      sort: true,
      headerStyle: () => {
        return { textAlign: 'center', color: 'white' };
      }
    },
    {
      dataField: 'status',
      text: 'Status',
      filter: textFilter(),
      headerStyle: () => {
        return { textAlign: 'center', color: 'white' };
      }
    }
  ];
  
  const defaultSorted = [
    {
      dataField: 'id',
      order: 'asc',
    },
  ];
  
  const selectRow = {
    mode: 'checkbox',
    clickToSelect: true,
    selectColumnPosition: 'right',
    style: { backgroundColor: '#474948' },
    onSelect: (row, isSelect, rowIndex, e) => {
      console.log(row);
      console.log(isSelect);
      (!changeMonArr.includes(row)) ? changeMonArr.push(row) : changeMonArr.splice(changeMonArr.indexOf(row), 1);
    },
    onSelectAll: (isSelect, rows, e) => { // still need to work on this one
      console.log(isSelect);
      console.log(rows);
      rows.map(row => {
        (!changeMonArr.includes(row)) ? changeMonArr.push(row) : changeMonArr.splice(changeMonArr.indexOf(row), 1);
      })
      console.log(changeMonArr)
    },
  };
  // create state for holding our tenantId field data  **SANTIAGO
  const [tenantId, setTenantId] = useState('');
  // create state for holding our API Token field data  **SANTIAGO
  const [apiToken, setapiToken] = useState('');
  // create state for the hosts  **SANTIAGO
  const [Monitors, setMonitors] = useState([]);
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
        timer: 3500,
        timerProgressBar: true,
      });
      console.log('something is missing');
      return false;
    }
    localStorage.setItem('tenantUrl', tenantId);
    localStorage.setItem('apiToken', apiToken);

    try {
      const response = await getSynMonitors(tenantId, apiToken);
      console.log('response:', response);

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
      const monitors = items.monitors.map((monitor, index) => {
        return {
          id: index + 1,
          synName: monitor.name,
          entityId: monitor.entityId,
          type: monitor.type,
          status: monitor.enabled,
        };
      });
      console.log('monitors:', monitors);
      setMonitors(monitors);
      Swal.close();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMonitorChanges = async (e) => {
    e.preventDefault();
    console.log(changeMonArr)
    const entitiesIdArr = changeMonArr.map(item => item.entityId) //extracts the entityId and puts it in an array
    console.log('entities:', entitiesIdArr)
    await changeSynMonConfig (tenantId, apiToken, entitiesIdArr)
    changeMonArr = []
    Swal.fire({
      icon: 'success',
      title: 'Status Changed!',
      text: 'Please wait a couple of seconds and check',
      timer: 2000,
      timerProgressBar: true,
    }).then(result => window.location.reload());

  };

  return (
    <>
      <Jumbotron
        fluid
        className='text-light'
        style={{ backgroundColor: '#191919' }}>
        <Container>
          <h1>Enable or disable your synthetic monitors</h1>
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
      <Container fluid>
        {Monitors.length !== 0 ? (
          <ToolkitProvider
            bootstrap4
            keyField='entityId'
            data={Monitors}
            columns={columns}
            defaultSorted={defaultSorted}
            striped
            hover
            condensed
            search
            exportCSV>
            {(props) => (
              <div>
                <h3>Global Search:</h3>
                <SearchBar {...props.searchProps} />
                <span style={{
                  backgroundColor: '#4fd5e0',
                  border: 'none',
                  marginLeft: '1%',
                  // marginRight: '40px',
                  paddingTop: '8px',
                  paddingBottom: '8px',
                }}><ClearSearchButton {...props.searchProps} /></span>
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
                <Button
                  onClick={handleMonitorChanges}
                  style={{
                    backgroundColor: '#4fd5e0',
                    color: 'black',
                    paddingTop: '8px',
                    paddingBottom: '8px',
                  }}>
                  Change status of selected monitors
                </Button>
                <BootstrapTable
                  selectRow={selectRow}
                  {...props.baseProps}
                  filter={filterFactory()}
                  rowStyle={ {color: 'white' } }
                />
              </div>
            )}
          </ToolkitProvider>
        ) : (
          <h3 className='justify-content-md-center'>
            {' '}
            Enter your tenant and API token
          </h3>
        )}
      </Container>
    </>
  );
};

export default SyntheticMonitors;
