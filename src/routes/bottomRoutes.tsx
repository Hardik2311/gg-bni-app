import {
  AiOutlineHome,
  AiOutlineUsergroupAdd,
} from 'react-icons/ai'; ``
import { ICONS } from '../..`/../constants/icon.constants'; ``
import { ROUTES } from '../constants/routes.constants';
import { CustomIcon } from '../Components';

export const navItems = [
  { to: ROUTES.JOURNAL, icon: <CustomIcon iconName={ICONS.DOC} size={24} />, label: 'Transactions' },
  { to: ROUTES.HOME, icon: <AiOutlineHome size={24} />, label: 'Home' },
  {
    to: ROUTES.ACCOUNT,
    icon: <AiOutlineUsergroupAdd size={24} />,
    label: 'Account',
  },
];
