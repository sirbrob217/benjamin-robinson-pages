const elements = {
  breadcrumb: document.querySelector('#breadcrumb'),
  documentation: document.querySelector('#documentation'),
  error: document.querySelector('#error-state'),
  familyList: document.querySelector('#family-list'),
  footerVersion: document.querySelector('#footer-version'),
  loading: document.querySelector('#loading-state'),
  navPanel: document.querySelector('.nav-panel'),
  navToggle: document.querySelector('#nav-toggle'),
  navVersion: document.querySelector('#nav-version'),
  search: document.querySelector('#family-search'),
  serverFilter: document.querySelector('#server-filter')
};

let commands = [];
let documentationVersion = '';
let serverAliases = new Map();

function element(tagName, attributes = {}, text = null) {
  const node = document.createElement(tagName);
  Object.entries(attributes).forEach(([name, value]) => {
    if (name === 'className') node.className = value;
    else node.setAttribute(name, value);
  });
  if (text !== null) node.textContent = text;
  return node;
}

function familyUrl(path) {
  const url = new URL(window.location.href);
  const serverKey = elements.serverFilter.value;
  url.search = '';
  url.hash = '';
  url.searchParams.set('family', path);
  if (serverKey) url.searchParams.set('server', serverKey);
  return `${url.pathname}${url.search}`;
}

function indexUrl() {
  const url = new URL(window.location.href);
  const serverKey = elements.serverFilter.value;
  url.search = '';
  url.hash = '';
  if (serverKey) url.searchParams.set('server', serverKey);
  return `${url.pathname}${url.search}`;
}

function selectedFamilyPath() {
  return new URLSearchParams(window.location.search).get('family');
}

function selectedServerKey() {
  return new URLSearchParams(window.location.search).get('server');
}

function commandMatchesServer(command, serverKey = elements.serverFilter.value) {
  if (!serverKey) return true;
  return command.server_keys.includes(serverKey) || command.server_keys.includes('all-installed-servers');
}

function commandAnchor(path) {
  return `method-${path.replaceAll('/', '-').replaceAll(' ', '-').toLowerCase()}`;
}

function serverPills(command) {
  const pills = element('div', { className: 'server-pills', 'aria-label': 'Available servers' });
  command.server_keys.forEach((key) => {
    const server = serverAliases.get(key);
    if (!server) return;

    const pill = element('span', { className: 'server-pill' });
    pill.append(
      element('img', { src: server.icon, alt: '', width: '22', height: '22', loading: 'lazy', 'aria-hidden': 'true' }),
      element('span', {}, server.alias)
    );
    pills.append(pill);
  });
  return pills;
}

function signature(command) {
  const parameters = command.options.map((option) => {
    const marker = option.required ? option.name : `${option.name} = optional`;
    return marker;
  });
  return `${command.name}${parameters.length ? `(${parameters.join(', ')})` : ''}`;
}

function optionConstraint(option) {
  const details = [];
  if (option.choices?.length) details.push(`choices: ${option.choices.map((choice) => choice.name).join(', ')}`);
  if (option.min_value !== undefined) details.push(`minimum: ${option.min_value}`);
  if (option.max_value !== undefined) details.push(`maximum: ${option.max_value}`);
  if (option.min_length !== undefined) details.push(`minimum length: ${option.min_length}`);
  if (option.max_length !== undefined) details.push(`maximum length: ${option.max_length}`);
  return details.join('; ');
}

function tagList(command) {
  const tags = element('div', { className: 'tags' });
  tags.append(element('p', { className: 'tag-title' }, 'Permission:'));
  const permissionList = element('ul');
  const permission = element('li');
  permission.append(element('code', {}, command.permission), document.createTextNode(' — required local access level'));
  permissionList.append(permission);
  tags.append(permissionList);

  tags.append(element('p', { className: 'tag-title' }, 'Availability:'));
  const availabilityList = element('ul');
  availabilityList.append(element('li', {}, command.availability));
  tags.append(availabilityList);
  return tags;
}

function parameterList(command) {
  if (!command.options.length) return null;

  const parameters = element('div', { className: 'tags' });
  parameters.append(element('p', { className: 'tag-title' }, 'Parameters:'));
  const list = element('ul', { className: 'parameter-list' });
  command.options.forEach((option) => {
    const item = element('li');
    const heading = element('div', { className: 'parameter-heading' });
    heading.append(element('span', { className: 'parameter-name' }, option.name));
    heading.append(element('span', { className: 'parameter-type' }, `(${option.type})`));
    if (!option.required) heading.append(element('em', {}, 'optional'));
    item.append(heading, element('p', {}, option.description));

    const constraint = optionConstraint(option);
    if (constraint) item.append(element('p', { className: 'constraint' }, constraint));
    list.append(item);
  });
  parameters.append(list);
  return parameters;
}

function methodDetail(command) {
  const section = element('section', { className: 'method-detail', id: commandAnchor(command.path) });
  const heading = element('h3', { className: 'signature' });
  heading.append(document.createTextNode('# '), element('strong', {}, signature(command)));
  section.append(heading);

  const discussion = element('div', { className: 'discussion' });
  discussion.append(element('p', {}, command.description));
  if (command.details) discussion.append(element('p', {}, command.details));
  section.append(discussion, tagList(command));

  const parameters = parameterList(command);
  if (parameters) section.append(parameters);
  return section;
}

function summaryTable(commandsToSummarize) {
  const table = element('table', { className: 'summary-table' });
  const body = element('tbody');
  commandsToSummarize.forEach((command) => {
    const row = element('tr');
    const signatureCell = element('td', { className: 'summary-signature' });
    signatureCell.append(element('a', { href: `#${commandAnchor(command.path)}` }, signature(command)));
    row.append(signatureCell, element('td', {}, command.description));
    body.append(row);
  });
  table.append(body);
  return table;
}

function sectionHeading(text) {
  return element('h2', { className: 'section-title' }, text);
}

function renderFamily(command) {
  const objectKind = command.type === 'chat_input' ? 'Command family' : 'App interaction';
  document.title = `${command.name} · Ulfgar Bot Command Reference`;
  elements.breadcrumb.replaceChildren(
    element('a', { href: indexUrl() }, 'Index'),
    document.createTextNode(' » '),
    element('span', {}, `${objectKind}: ${command.name}`)
  );

  const header = element('header', { className: 'object-header' });
  header.append(element('p', { className: 'object-kind' }, objectKind));
  header.append(element('h1', {}, command.name));
  header.append(element('p', { className: 'defined-in' }, `${command.category} · ${command.availability}`));
  header.append(serverPills(command));

  const overview = element('section', { className: 'doc-section' });
  overview.append(sectionHeading('Overview'), element('p', {}, command.description));
  if (command.details) overview.append(element('p', {}, command.details));
  overview.append(tagList(command));

  const documentedCommands = command.subcommands.length ? command.subcommands : [command];
  const label = command.subcommands.length ? 'Subcommand' : 'Command';
  const summary = element('section', { className: 'doc-section' });
  summary.append(sectionHeading(`${label} Summary`), summaryTable(documentedCommands));

  const details = element('section', { className: 'doc-section' });
  details.append(sectionHeading(`${label} Details`));
  documentedCommands.forEach((subcommand) => details.append(methodDetail(subcommand)));

  elements.documentation.replaceChildren(header, overview, summary, details);
}

function commandGroups() {
  const alphabetically = (left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
  return {
    appInteractions: commands
      .filter((command) => command.type !== 'chat_input' && commandMatchesServer(command))
      .sort(alphabetically),
    commandFamilies: commands
      .filter((command) => command.type === 'chat_input' && commandMatchesServer(command))
      .sort(alphabetically)
  };
}

function familyCards(group) {
  const index = element('div', { className: 'family-index' });
  group.forEach((command) => {
    const card = element('article', { className: 'family-index-item' });
    const heading = element('h3');
    const commandCount = command.subcommands.length || 1;
    heading.append(element('a', { href: familyUrl(command.path) }, command.name));
    card.append(heading, element('p', {}, command.description));
    card.append(serverPills(command));
    card.append(element('small', {}, `${commandCount} documented command${commandCount === 1 ? '' : 's'}`));
    index.append(card);
  });
  return index;
}

function renderIndex() {
  document.title = 'Ulfgar Bot Command Reference';
  elements.breadcrumb.replaceChildren(element('span', {}, 'Reference Index'));

  const header = element('header', { className: 'object-header' });
  header.append(element('p', { className: 'object-kind' }, 'Reference index'));
  header.append(element('h1', {}, 'Ulfgar Bot Commands'));
  const selectedServer = serverAliases.get(elements.serverFilter.value);
  const indexContext = selectedServer ? `${documentationVersion} · Available on ${selectedServer.alias}` : documentationVersion;
  header.append(element('p', { className: 'defined-in' }, indexContext));

  const { appInteractions, commandFamilies } = commandGroups();
  const interactionSection = element('section', { className: 'doc-section prose' });
  interactionSection.append(
    sectionHeading('App Interactions'),
    element('p', {}, 'Actions available from Discord’s Apps context menu. Future message and user interactions will appear here automatically.'),
    familyCards(appInteractions)
  );

  const commandSection = element('section', { className: 'doc-section prose' });
  commandSection.append(
    sectionHeading('Command Families'),
    element('p', {}, 'Each family groups related slash commands. Choose a family to see its subcommands, permissions, options, choices, and limits.'),
    familyCards(commandFamilies)
  );
  elements.documentation.replaceChildren(header, interactionSection, commandSection);
}

function appendNavigationGroup(title, group, normalizedQuery, selected) {
  const matchingCommands = group.filter((command) => {
    const searchable = [command.name, command.category, command.description, ...command.subcommands.map((item) => item.name)]
      .join(' ').toLowerCase();
    return !normalizedQuery || searchable.includes(normalizedQuery);
  });
  if (!matchingCommands.length) return;

  elements.familyList.append(element('li', { className: 'nav-group-title' }, title));
  matchingCommands.forEach((command) => {
    const item = element('li');
    const link = element('a', { href: familyUrl(command.path) });
    if (command.path === selected) link.setAttribute('aria-current', 'page');
    link.append(element('span', { className: 'family-name' }, command.name));
    link.append(element('small', {}, command.category));
    item.append(link);

    if (command.subcommands.length) {
      const children = element('ul', { className: 'subcommand-list' });
      command.subcommands.forEach((subcommand) => {
        const child = element('li');
        child.append(element('a', { href: `${familyUrl(command.path)}#${commandAnchor(subcommand.path)}` }, subcommand.name));
        children.append(child);
      });
      item.append(children);
    }
    elements.familyList.append(item);
  });
}

function populateServerFilter() {
  const selected = selectedServerKey();
  [...serverAliases.values()]
    .filter((server) => server.key !== 'all-installed-servers')
    .sort((left, right) => left.alias.localeCompare(right.alias, undefined, { sensitivity: 'base' }))
    .forEach((server) => {
      const option = element('option', { value: server.key }, server.alias);
      elements.serverFilter.append(option);
    });
  if (serverAliases.has(selected) && selected !== 'all-installed-servers') elements.serverFilter.value = selected;
}

function renderNavigation(query = '') {
  const selected = selectedFamilyPath();
  const normalizedQuery = query.trim().toLowerCase();
  elements.familyList.replaceChildren();
  const { appInteractions, commandFamilies } = commandGroups();
  appendNavigationGroup('App interactions', appInteractions, normalizedQuery, selected);
  appendNavigationGroup('Command families', commandFamilies, normalizedQuery, selected);
}

function closeNavigation() {
  elements.navPanel.classList.remove('nav-panel--open');
  elements.navToggle.setAttribute('aria-expanded', 'false');
}

async function loadDocumentation() {
  try {
    const response = await fetch('data/commands.json');
    if (!response.ok) throw new Error(`command data returned ${response.status}`);
    const data = await response.json();
    if (data.schema_version !== 1 || !Array.isArray(data.commands) || !Array.isArray(data.server_aliases)) {
      throw new Error('unsupported command data');
    }

    commands = data.commands;
    serverAliases = new Map(data.server_aliases.map((server) => [server.key, server]));
    populateServerFilter();
    documentationVersion = data.generated_from;
    elements.navVersion.textContent = documentationVersion;
    elements.footerVersion.textContent = `Ulfgar Bot command documentation · ${documentationVersion}`;
    renderNavigation();

    const selected = selectedFamilyPath();
    const command = commands.find((candidate) => candidate.path === selected);
    if (selected && !command) throw new Error(`unknown command family: ${selected}`);
    if (command && commandMatchesServer(command)) renderFamily(command);
    else {
      if (command) {
        const url = new URL(window.location.href);
        url.searchParams.delete('family');
        url.hash = '';
        window.history.replaceState({}, '', `${url.pathname}${url.search}`);
      }
      renderIndex();
    }

    elements.loading.hidden = true;
    elements.documentation.hidden = false;
  } catch (error) {
    console.error(error);
    elements.loading.hidden = true;
    elements.error.hidden = false;
  } finally {
    elements.familyList.setAttribute('aria-busy', 'false');
  }
}

elements.search.addEventListener('input', (event) => renderNavigation(event.target.value));
elements.serverFilter.addEventListener('change', () => {
  const url = new URL(window.location.href);
  if (elements.serverFilter.value) url.searchParams.set('server', elements.serverFilter.value);
  else url.searchParams.delete('server');

  const selectedCommand = commands.find((command) => command.path === selectedFamilyPath());
  if (selectedCommand && commandMatchesServer(selectedCommand)) renderFamily(selectedCommand);
  else {
    url.searchParams.delete('family');
    url.hash = '';
    renderIndex();
  }
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  renderNavigation(elements.search.value);
});
elements.navToggle.addEventListener('click', () => {
  const open = elements.navPanel.classList.toggle('nav-panel--open');
  elements.navToggle.setAttribute('aria-expanded', open.toString());
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeNavigation();
});
loadDocumentation();
