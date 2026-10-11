/** Local table insertion through the original dokieli command and form styling. */
import {insertTable} from '../editor/commands/table.js';
export class HouseSlashMenu {
 constructor(view){this.view=view;this.dom=document.createElement('div');this.dom.id='document-slashmenu';this.dom.className='do editor-slashmenu editor-form';this.dom.hidden=true;this.dom.innerHTML='<form><fieldset><legend>Insert table</legend><label>Rows <input name="rows" type="number" min="1" max="100" value="3" required></label><label>Columns <input name="columns" type="number" min="1" max="20" value="3" required></label><label>Caption <input name="caption" type="text"></label><div><button type="submit">Insert</button><button type="button" data-cancel>Cancel</button></div></fieldset></form>';this.dom.querySelector('form').addEventListener('submit',event=>{event.preventDefault();const data=new FormData(event.target);insertTable({rows:Number(data.get('rows')),columns:Number(data.get('columns')),caption:String(data.get('caption'))})(view.state,view.dispatch);this.hideMenu();view.focus();});this.dom.querySelector('[data-cancel]').addEventListener('click',()=>this.hideMenu());document.body.append(this.dom);}
 showForm(type){if(type!=='table')throw new Error('Only local table insertion is available from this menu.');this.dom.hidden=false;this.dom.style.display='block';this.dom.querySelector('input').focus();}
 showMenu(left,top){this.dom.style.left=`${Math.max(10,left)}px`;this.dom.style.top=`${top}px`;this.showForm('table');}
 hideMenu(){this.dom.hidden=true;this.dom.style.display='none';}
 destroy(){this.dom.remove();}
}
