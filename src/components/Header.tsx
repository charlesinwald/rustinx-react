import React, { useState } from 'react';
import { SearchBar } from './nested/index';
import Aaa from '../../assets/pause-svgrepo-com.svg';

const Header = () => {
  const [isRed, setIsRed] = useState(true); 

  const toggleLight = () => {
    setIsRed(prevState => !prevState); 
  };

  const handleButtonClick = (buttonName: string) => {
    console.log(`Button ${buttonName} clicked`);
  };
  return (
    <header>
      <div className="header-left">
        {/* <SearchBar /> */}
        <p className='headlg'>rustinx-react</p>
      </div>
      <div className="header-right">
        {/* <div className="ssh-status"  onClick={toggleLight}>
          <div className="led-box">
            <div className={isRed ? 'led-red' : 'led-green'}></div>
          </div>
          <p className="status-text">SSH Status</p>
        </div>
        <div className="action-buttons">
      <button onClick={() => handleButtonClick('Button 1')}>
        <svg
          fill="#499c54"
          height="20px"
          width="20px"
          version="1.1"
          id="Layer_1"
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          viewBox="0 0 512 512"
          enableBackground="new 0 0 512 512"
          xmlSpace="preserve"
          stroke="#499c54"
        >
          <polygon points="0,0 0,512 512,256" />
        </svg>
      </button>
      <button onClick={() => handleButtonClick('Button 3')}>
      <img src={Aaa} alt="SVG Image" width="24" height="24" />

      </button>
      <button onClick={() => handleButtonClick('Button 2')}>
        <svg
          width="32px"
          height="32px"
          viewBox="0 0 30 27"
          fill="#b0b0b0"
          stroke="#b0b0b0"
        >
          <path
            d="M 15 3 L 15 6 C 10.041282 6 6 10.04128 6 15 C 6 19.95872 10.041282 24 15 24 C 19.958718 24 24 19.95872 24 15 C 24 13.029943 23.355254 11.209156 22.275391 9.7246094 L 20.849609 11.150391 C 21.575382 12.253869 22 13.575008 22 15 C 22 18.87784 18.877838 22 15 22 C 11.122162 22 8 18.87784 8 15 C 8 11.12216 11.122162 8 15 8 L 15 11 L 20 7 L 15 3 z "
          />
        </svg>
      </button> 
      
      
      
      </div> */}
      </div>
    </header>
  );
};

export default Header;
