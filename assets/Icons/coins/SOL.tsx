import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> { }

const SOL: React.FC<IconProps> = (props) => {
    return (
        <svg width={props.width || 24} overflow={'visible'}
            height={props.height || 24} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="12" fill="url(#sol_gradient)" />
            <path d="M7.5 15.75L9.15 14.1C9.225 14.025 9.3375 13.9875 9.45 13.9875H17.25C17.4375 13.9875 17.5312 14.2125 17.4 14.3437L15.75 15.9937C15.675 16.0687 15.5625 16.1062 15.45 16.1062H7.65C7.4625 16.1062 7.3687 15.8812 7.5 15.75ZM7.5 8.00625L9.15 6.35625C9.225 6.28125 9.3375 6.24375 9.45 6.24375H17.25C17.4375 6.24375 17.5312 6.46875 17.4 6.6L15.75 8.25C15.675 8.325 15.5625 8.3625 15.45 8.3625H7.65C7.4625 8.3625 7.3687 8.1375 7.5 8.00625ZM17.4 11.85L15.75 10.2C15.675 10.125 15.5625 10.0875 15.45 10.0875H7.65C7.4625 10.0875 7.3687 10.3125 7.5 10.4437L9.15 12.0937C9.225 12.1687 9.3375 12.2062 9.45 12.2062H17.25C17.4375 12.2062 17.5312 11.9812 17.4 11.85Z" fill="white" />
            <defs>
                <linearGradient id="sol_gradient" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#9945FF" />
                    <stop offset="0.5" stopColor="#14F195" />
                    <stop offset="1" stopColor="#00D1FF" />
                </linearGradient>
            </defs>
        </svg>
    );
};

export default SOL;
