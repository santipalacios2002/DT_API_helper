import React from 'react';
import { push as Menu } from 'react-burger-menu';

class Example extends React.Component {
  showSettings(event) {
    event.preventDefault();
  }

  render() {
    // NOTE: You also need to provide styles, see https://github.com/negomi/react-burger-menu#styling
    return (
      <Menu width={ 280 } noOverlay pageWrapId={'page-wrap'} outerContainerId={'outer-container'}>
        <a id='home' className='menu-item' href='/'>
          Home
        </a>
        <a id='about' className='menu-item' href='/HUConsumption'>
        HU Consumption
        </a>
        <a id='contact' className='menu-item' href='/K8sReport'>
        K8s Report
        </a>
        <a id='contact' className='menu-item' href='/SyntheticMonitor'>
        Synthetic Monitors Edit
        </a>
{/*         <a onClick={this.showSettings} className='menu-item--small' href=''>
          Settings
    </a> */}
      </Menu>
    );
  }
}

export default Example;
