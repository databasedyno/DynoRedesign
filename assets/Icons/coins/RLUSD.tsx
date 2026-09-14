import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> { }

const RLUSD: React.FC<IconProps> = (props) => {
    return (
        <svg width={props.width || 24} overflow={'visible'}
            height={props.height || 24} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="12" fill="#23292F" />
            <circle cx="12" cy="12" r="10.5" stroke="white" strokeWidth="0.75" strokeOpacity="0.2" />
            <text x="12" y="13" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="5.5" fontWeight="700" fontFamily="Arial, sans-serif" letterSpacing="0.3">
                RL
            </text>
            <text x="12" y="17.5" textAnchor="middle" dominantBaseline="middle" fill="#00D1FF" fontSize="4" fontWeight="600" fontFamily="Arial, sans-serif">
                USD
            </text>
            <path d="M8.5 7.5H15.5" stroke="white" strokeWidth="0.75" strokeLinecap="round" strokeOpacity="0.4" />
        </svg>
    );
};

export default RLUSD;
