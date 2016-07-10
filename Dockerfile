FROM node:4

# Install prosemirror
WORKDIR /prosemirror
COPY package.json /prosemirror/package.json
COPY Makefile /prosemirror/Makefile
COPY .npmignore /prosemirror/.mpmignore
COPY .babelrc /prosemirror/.babelrc

RUN cd /prosemirror; npm install

CMD ["npm", "run", "demo"]