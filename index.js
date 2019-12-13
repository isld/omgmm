const nodemailer = require('nodemailer');
const fs = require('fs');
const csv = require('csv-parser');
const iconv = require('iconv-lite');

const converter = iconv.decodeStream('win1251');
const settings = JSON.parse(fs.readFileSync('settings.json'));
const tpl = {
	subject: fs.readFileSync('subject.tpl', 'utf8'),
	body: fs.readFileSync('body.tpl', 'utf8'),
};
const matcher = /{{{([a-zA-Z0-9]*)}}}/gi;

let columns = [];
let match;
let stack = `${tpl.subject} ${tpl.body}`;

while (match = matcher.exec(stack)) {
	columns.indexOf(match[1]) === -1 && columns.push(match[1]);
}

let transporter = nodemailer.createTransport(settings.transport);

let messages = [];
let success = [];
let failure = [];

fs.createReadStream('list.csv')
	.pipe(converter)
	.pipe(csv())
	.on('data', ({ address, file, ...rest }) => {
		let subject = tpl.subject;
		let text = tpl.body;

		columns.map(column => {
			subject = subject.replace(`{{{${column}}}}`, rest[column]);
			text = text.replace(`{{{${column}}}}`, rest[column]);
		});

		messages.push({
			from: 'complicated@abv.bg',
			to: address,
			subject,
			text,
			attachments: [
				{
					path: file,
				}
			],
		});
	})
	.on('end', () => {
		messages.map(message => {
			transporter.sendMail(message, function(err, info) {
				if (err) {
					console.error(err);
					failure.push(message.to);
				} else {
					console.log(`${message.to} - success`);
					success.push(message.to);
				}
				if (success.length + failure.length === messages.length) {
					console.log(`Success: ${success.length} out of ${messages.length}`);
					process.exit();
				}
			});
		});
	});

