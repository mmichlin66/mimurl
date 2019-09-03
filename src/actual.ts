import * as api from "./api"



// Parses the given URL
export function parseURL( url: string): api.IParsedActualURL
{
	let parsedURL: api.IParsedActualURL = {};

	// find protocol
	let hostnameIndex: number;
	let protocolSeparatorIndex = url.indexOf( "://");
	if (protocolSeparatorIndex === 0)
		throw new Error( "URL cannot start from '://'");
	else if (protocolSeparatorIndex > 0)
	{
		parsedURL.protocol = url.substr( 0, protocolSeparatorIndex);
		if (!isValidProtocol( parsedURL.protocol))
			throw new Error( `Protocol '${parsedURL.protocol}' contains invalid characters`);

		hostnameIndex = protocolSeparatorIndex + 3;
	}
	else
		hostnameIndex = url[0] === '/' ? -1 : 0;

	let nextSearchIndexStart = hostnameIndex < 0 ? 0 : hostnameIndex;	
	let colonIndex = url.indexOf( ':', nextSearchIndexStart);
	let slashIndex = url.indexOf( '/', nextSearchIndexStart);
	let questionIndex = url.indexOf( '?', nextSearchIndexStart);
	let hashIndex = url.indexOf( '#', nextSearchIndexStart);

	if (hostnameIndex >= 0)
	{
		if (colonIndex > 0)
			parsedURL.hostname = url.substr( hostnameIndex, colonIndex - hostnameIndex).split( '.');
		else if (slashIndex > 0)
			parsedURL.hostname = url.substr( hostnameIndex, slashIndex - hostnameIndex).split( '.');
		else if (questionIndex > 0)
			parsedURL.hostname = url.substr( hostnameIndex, questionIndex - hostnameIndex).split( '.');
		else if (hashIndex > 0)
			parsedURL.hostname = url.substr( hostnameIndex, hashIndex - hostnameIndex).split( '.');
		else
			parsedURL.hostname = url.substr( hostnameIndex).split( '.');

		for( let i = 0; i < parsedURL.hostname.length; i++)
		{
			let segment = parsedURL.hostname[i];
			if (!isValidHostnameSegment( segment))
				throw new Error( `Hostname segment '${segment}' contains invalid characters`);
		}
	}

	if (colonIndex > 0)
	{
		let port: string;
		if (slashIndex > 0)
			port = url.substr( colonIndex + 1, slashIndex - colonIndex - 1);
		else if (questionIndex > 0)
			port = url.substr( colonIndex + 1, questionIndex - colonIndex - 1);
		else if (hashIndex > 0)
			port = url.substr( colonIndex + 1, hashIndex - colonIndex - 1);
		else
			port = url.substr( colonIndex + 1);

		if (!isValidPort( port))
			throw new Error( `Port '${port}' contains non-numerical characters`);

		parsedURL.port = Number(port);
	}

	// slash can be the first character if there is no hostname
	if (slashIndex >= 0)
	{
		if (questionIndex > 0)
			parsedURL.path = url.substr( slashIndex + 1, questionIndex - slashIndex - 1).split( '/');
		else if (hashIndex > 0)
			parsedURL.path = url.substr( slashIndex + 1, hashIndex - slashIndex - 1).split( '/');
		else
			parsedURL.path = url.substr( slashIndex + 1).split( '/');

		for( let i = 0; i < parsedURL.path.length; i++)
		{
			let segment = parsedURL.path[i];
			if (!isValidSegment( segment))
				throw new Error( `Path segment '${segment}' contains invalid characters`);

			try
			{
				segment = decodeURIComponent( segment);
			}
			catch( err)
			{
				throw new Error( `Path segment '${segment}' cannot be URL-decoded. Error: ${err.message}`);
			}

			parsedURL.path[i] = segment;
		}
	}

	if (questionIndex > 0)
	{
		parsedURL.query = {};
		let searchString: string;
		if (hashIndex > 0)
			searchString = url.substr( questionIndex + 1, hashIndex - questionIndex - 1);
		else
			searchString = url.substr( questionIndex + 1);

		let params = searchString.split( '&');
		for( let param of params)
		{
			if (!param)
				throw new Error( `Invalid stucture of query string URL part`);

			let arr = param.split( '=');
			let name: string;
			let value: string;
			if (arr.length > 2)
				throw new Error( `Query string parameter '${param}' has more than one '=' symbol`);

			if (arr.length < 2)
			{
				name = param;
				value = undefined;
			}
			else
			{
				name = arr[0];
				value = arr[1];
			}

			if (!isValidQueryParamName( this.name))
				throw new Error( `Query string parameter name '${name}' contains invalid character`);

			if (value)
			{
				if (!isValidSegment( value))
					throw new Error( `Value '${value}' of query string parameter '${name}' contains invalid characters`);

				try
				{
					value = decodeURIComponent( value);
				}
				catch( err)
				{
					throw new Error( `Value '${value}' of query string parameter '${name}' cannot be URL-decoded. Error: ${err.message}`);
				}
			}

			if (name in parsedURL.query)
				parsedURL.query[name].push( value);
			else
				parsedURL.query[name] = [value];
		}

	}

	if (hashIndex > 0)
	{
		let value = url.substr( hashIndex + 1);
		if (!isValidSegment( value))
			throw new Error( `Value '${value}' of hash URL part contains invalid characters`);

		try
		{
			parsedURL.hash = decodeURIComponent( value);
		}
		catch( err)
		{
			throw new Error( `Value '${value}' of hash URL part cannot be URL-decoded. Error: ${err.message}`);
		}
}

	return parsedURL;
}



/**
 * Determines whether the given string is a valid protocol URL part. To be valid, it must
 * be alpha-numeric.
 * @param s
 */
function isValidProtocol( s: string): boolean
{
	return /^[a-z0-9]+$/i.test(s);
}



/**
 * Determines whether the given string is a valid segment in the hostname URL part. To be valid,
 * it must be alpha-numeric or underscore '_' or dash '-'.
 * @param s
 */
function isValidHostnameSegment( s: string): boolean
{
	return /^[a-z0-9_\-]+$/i.test(s);
}



/**
 * Determines whether the given string is a valid port URL part. To be valid, it must
 * be numeric.
 * @param s
 */
function isValidPort( s: string): boolean
{
	return /^\d+$/i.test(s);
}



/**
 * Determines whether the given string is a valid segment in path, query string or hash URL part.
 * To be valid, it must be alpha-numeric or undescore '_' or dash '-' or percent sign '%' (for
 * URL-encoded characters).
 * @param s
 */
function isValidSegment( s: string): boolean
{
	return /^[a-z0-9_\-\.%]+$/i.test(s);
}



/**
 * Determines whether the given string is a valid name of a query string parameter.
 * To be valid, it must be alpha-numeric or undescore '_' or dash '-'.
 * @param s
 */
function isValidQueryParamName( s: string): boolean
{
	return /^[a-z0-9_\-]+$/i.test(s);
}



