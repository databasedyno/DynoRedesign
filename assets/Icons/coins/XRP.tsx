import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> { }

const XRP: React.FC<IconProps> = (props) => {
    return (
        <svg width={props.width || 24} overflow={'visible'}
            height={props.height || 24} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="12" fill="#23292F" />
            <path d="M7.2 6.6H9.15L12 9.6L14.85 6.6H16.8L12.9 10.725C12.675 10.9687 12.3437 11.1 12 11.1C11.6563 11.1 11.325 10.9687 11.1 10.725L7.2 6.6ZM7.2 17.4H9.15L12 14.4L14.85 17.4H16.8L12.9 13.275C12.675 13.0312 12.3437 12.9 12 12.9C11.6563 12.9 11.325 13.0312 11.1 13.275L7.2 17.4Z" fill="white" />
        </svg>
    );
};

export default XRP;
