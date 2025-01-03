import { IconType } from 'react-icons/lib';
import './Features.css';

interface FeatureProps {
  image: IconType;
  title: string;
  content: string;
}

function Feature({ image: Icon, title, content }: FeatureProps) {
  return (
    <div className='feature' id='fbackground'>
      <div className='image-container'>
      <span className="icon">
        <Icon className="mx-auto lg:m-0"/>
      </span>
      </div>
      <div className="feature-content">      
        <h4>{title}</h4>
        <p>{content}</p>
        <div className="shine"></div>
      </div>
    </div>
  );
}

export { Feature };