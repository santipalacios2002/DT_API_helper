import React from 'react';
import dynatrace from '../images/dynatrace.png'

const transitionStyle = {
    backgroundImage: `url(${dynatrace})`,
    backgroundSize: 'auto 30%',
    backgroundRepeat: 'no-repeat',
    backgroundPositionX: 'center',
    backgroundPositionY: '70%',
    color: 'white', 
    paddingTop: '10%',
    height: '1000px', 
  };

const MainPage = () => {
    return (
        <div style={transitionStyle}>
        <h1 id='titleDT'>Welcome to Dynatrace API helper</h1>
        <h2 id='testing' >Click on "Burger Menu"</h2>
        </div>
        );
}

export default MainPage